#!/usr/bin/env bash
# =============================================================================
#  Cognitive Tracking — Dev Launcher
#  Avvia DB check → Backend (FastAPI) → Frontend (Vite) con un comando
#  Supporta sia PostgreSQL locale che database remoto (es. Supabase)
# =============================================================================

set -euo pipefail

# ── Colori ANSI ──────────────────────────────────────────────────────────────
RESET="\033[0m"
BOLD="\033[1m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"

# ── Prefissi log ─────────────────────────────────────────────────────────────
log_sys()     { echo -e "${YELLOW}${BOLD}[SYSTEM]${RESET}  $*"; }
log_back()    { echo -e "${BLUE}${BOLD}[BACKEND]${RESET} $*"; }
log_front()   { echo -e "${GREEN}${BOLD}[FRONTEND]${RESET} $*"; }
log_ok()      { echo -e "${CYAN}${BOLD}[OK]${RESET}      $*"; }
log_err()     { echo -e "${RED}${BOLD}[ERROR]${RESET}   $*" >&2; }

# ── Path relativi alla root del progetto ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
ENV_FILE="$BACKEND_DIR/.env"

# PID dei processi figli (popolati più avanti)
BACKEND_PID=""
FRONTEND_PID=""
TUNNEL_PID=""
TUNNEL_URL=""
TUNNEL_LOG="/tmp/ct_tunnel.log"

# ── Shutdown pulito ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  log_sys "Shutdown in corso — arresto di tutti i servizi..."
  [ -n "$TUNNEL_PID" ]   && kill "$TUNNEL_PID"   2>/dev/null && log_sys   "Tunnel cloudflared fermato (PID $TUNNEL_PID)"
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null && log_back  "Uvicorn fermato (PID $BACKEND_PID)"
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && log_front "Vite fermato (PID $FRONTEND_PID)"
  [ -n "$BACKEND_PID" ]  && wait "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && wait "$FRONTEND_PID" 2>/dev/null || true
  log_sys "Tutti i servizi fermati. Arrivederci! 👋"
  exit 0
}

trap cleanup SIGINT SIGTERM

# =============================================================================
#  1. CHECK PREREQUISITI
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║   Cognitive Tracking — Dev Launcher      ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""
log_sys "Verifica prerequisiti..."

MISSING=0

check_cmd() {
  local cmd=$1 label=$2 hint=$3
  if command -v "$cmd" &>/dev/null; then
    log_ok "$label trovato: $(command -v "$cmd")"
  else
    log_err "$label NON trovato. $hint"
    MISSING=1
  fi
}

check_cmd python3 "Python 3" "Installa con: brew install python"
check_cmd node    "Node.js"  "Installa con: brew install node"
check_cmd npm     "npm"      "Installato insieme a Node.js"
check_cmd psql    "psql"     "Installa con: brew install postgresql@15"

[ "$MISSING" -eq 1 ] && { log_err "Risolvi i prerequisiti mancanti e riprova."; exit 1; }

PY_VER=$(python3 --version 2>&1)
NODE_VER=$(node --version 2>&1)
log_sys "Versioni: $PY_VER | Node $NODE_VER"

# =============================================================================
#  2. CHECK FILE .env
# =============================================================================
echo ""
log_sys "Verifica configurazione .env..."

if [ ! -f "$ENV_FILE" ]; then
  log_err "File '$ENV_FILE' non trovato!"
  echo ""
  echo -e "  ${YELLOW}Crea il file con:${RESET}"
  echo -e "  ${BOLD}cp $BACKEND_DIR/.env.example $ENV_FILE${RESET}"
  echo -e "  ${BOLD}# poi modifica DATABASE_URL e SECRET_KEY${RESET}"
  echo ""
  exit 1
fi
log_ok ".env trovato: $ENV_FILE"

DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || true)
if [ -z "$DB_URL" ]; then
  log_err "DATABASE_URL non trovata nel file .env"
  exit 1
fi

# =============================================================================
#  3. CHECK PORTE GIÀ OCCUPATE
# =============================================================================
echo ""
log_sys "Verifica disponibilità porte..."

free_port() {
  local port=$1 service=$2
  if lsof -ti:"$port" &>/dev/null; then
    local pids
    pids=$(lsof -ti:"$port")
    log_sys "Porta $port occupata ($service) — termino processo/i: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    if lsof -ti:"$port" &>/dev/null; then
      log_err "Impossibile liberare la porta $port. Esegui manualmente: kill -9 $(lsof -ti:$port)"
      exit 1
    fi
    log_ok "Porta $port liberata"
  else
    log_ok "Porta $port libera ($service)"
  fi
}

free_port 8000 "Backend/Uvicorn"
free_port 5173 "Frontend/Vite"

# =============================================================================
#  4. CHECK CONNESSIONE DATABASE
#  Funziona sia con PostgreSQL locale che con DB remoti (Supabase, ecc.)
#  Usa psql con la DATABASE_URL completa invece di pg_isready
# =============================================================================
echo ""
log_sys "Verifica connessione database..."

# Determina se è locale o remoto per il messaggio di errore corretto
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
IS_LOCAL=0
if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]]; then
  IS_LOCAL=1
fi

WAIT_SECS=0
MAX_WAIT=15
until psql "$DB_URL" -c "SELECT 1" -q --no-psqlrc &>/dev/null; do
  WAIT_SECS=$((WAIT_SECS + 1))
  if [ "$WAIT_SECS" -ge "$MAX_WAIT" ]; then
    log_err "Impossibile connettersi al database dopo ${MAX_WAIT}s."
    echo ""
    if [ "$IS_LOCAL" -eq 1 ]; then
      echo -e "  ${YELLOW}Database locale — prova ad avviare PostgreSQL:${RESET}"
      echo -e "  ${BOLD}brew services start postgresql@15${RESET}"
    else
      echo -e "  ${YELLOW}Database remoto ($DB_HOST) — verifica:${RESET}"
      echo -e "  - Connessione internet attiva"
      echo -e "  - DATABASE_URL corretta nel file .env"
      echo -e "  - Credenziali e permessi sul DB remoto"
    fi
    echo ""
    exit 1
  fi
  printf "\r  ${YELLOW}Database non raggiungibile... %ds${RESET}" "$WAIT_SECS"
  sleep 1
done

if [ "$IS_LOCAL" -eq 1 ]; then
  log_ok "Database locale pronto su $DB_HOST"
else
  log_ok "Database remoto raggiungibile ($DB_HOST)"
fi

# =============================================================================
#  5. VIRTUAL ENV PYTHON
# =============================================================================
echo ""
log_sys "Configurazione Python venv..."

if [ ! -d "$VENV_DIR" ]; then
  log_back "Creazione virtual environment in $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
  log_ok "Virtual environment creato"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
log_ok "Virtual environment attivato"

log_back "Aggiornamento dipendenze Python (pip install -q)..."
pip install -r "$BACKEND_DIR/requirements.txt" -q
log_ok "Dipendenze Python aggiornate"

# =============================================================================
#  6. MIGRAZIONI ALEMBIC
# =============================================================================
echo ""
log_sys "Esecuzione migrazioni database..."
cd "$BACKEND_DIR"

if alembic upgrade head 2>&1 | tee /tmp/alembic_output.txt | grep -qE "^ERROR|FATAL"; then
  log_err "Alembic migration fallita. Output:"
  cat /tmp/alembic_output.txt
  exit 1
fi
log_ok "Migrazioni database aggiornate"

cd "$PROJECT_ROOT"

# =============================================================================
#  7. NODE MODULES
# =============================================================================
echo ""
log_sys "Verifica dipendenze frontend..."

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  log_front "Installazione npm packages (prima esecuzione)..."
  npm --prefix "$FRONTEND_DIR" install --silent
  log_ok "npm packages installati"
else
  log_ok "node_modules presente (skip install)"
fi

# =============================================================================
#  8. AVVIO SERVIZI IN PARALLELO
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
log_sys "Avvio servizi in parallelo..."
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
(
  cd "$BACKEND_DIR"
  source "$VENV_DIR/bin/activate"
  while IFS= read -r line; do
    echo -e "${BLUE}${BOLD}[BACKEND]${RESET} $line"
  done < <(uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1)
) &
BACKEND_PID=$!
log_back "Uvicorn avviato (PID $BACKEND_PID) → http://localhost:8000"
log_back "Docs API: http://localhost:8000/docs"

sleep 4

# ── Frontend ──────────────────────────────────────────────────────────────────
(
  cd "$FRONTEND_DIR"
  while IFS= read -r line; do
    echo -e "${GREEN}${BOLD}[FRONTEND]${RESET} $line"
  done < <(npm run dev 2>&1)
) &
FRONTEND_PID=$!
log_front "Vite avviato (PID $FRONTEND_PID) → http://localhost:5173"

# =============================================================================
#  9. CLOUDFLARE TUNNEL (opzionale — accesso remoto da qualsiasi rete)
# =============================================================================
echo ""
if command -v cloudflared &>/dev/null; then
  log_sys "Avvio Cloudflare Tunnel (accesso remoto)..."
  rm -f "$TUNNEL_LOG"
  cloudflared tunnel --url http://localhost:5173 > "$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  WAITED=0
  while [ "$WAITED" -lt 25 ]; do
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
    [ -n "$TUNNEL_URL" ] && break
    sleep 1
    WAITED=$((WAITED + 1))
    printf "\r  ${YELLOW}Attendo URL tunnel... %ds${RESET}" "$WAITED"
  done
  [ "$WAITED" -gt 0 ] && echo ""

  if [ -n "$TUNNEL_URL" ]; then
    log_ok "Tunnel pronto: $TUNNEL_URL"
  else
    log_sys "Tunnel avviato (PID $TUNNEL_PID) — URL non ancora disponibile"
  fi
else
  log_sys "cloudflared non trovato — solo accesso rete locale. Installa con: brew install cloudflared"
fi

# =============================================================================
#  10. RIEPILOGO E ATTESA
# =============================================================================

# Rileva IP locale per accesso da smartphone (prova en0, poi en1, poi primo IP non-loopback)
LOCAL_IP=""
for iface in en0 en1 wlan0 eth0; do
  IP=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
  if [ -n "$IP" ]; then
    LOCAL_IP="$IP"
    break
  fi
done
# fallback: primo indirizzo IPv4 non-loopback
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1 || true)
fi

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${CYAN}${BOLD}  ✅ Tutti i servizi avviati!${RESET}"
echo ""
echo -e "  ${BLUE}Backend API${RESET}  → ${BOLD}http://localhost:8000${RESET}"
echo -e "  ${BLUE}API Docs${RESET}     → ${BOLD}http://localhost:8000/docs${RESET}"
echo -e "  ${GREEN}Frontend App${RESET} → ${BOLD}http://localhost:5173${RESET}"
if [ -n "$LOCAL_IP" ]; then
  echo ""
  echo -e "  ${YELLOW}📱 Da smartphone (stessa rete WiFi):${RESET}"
  echo -e "  ${GREEN}Frontend${RESET}     → ${BOLD}http://${LOCAL_IP}:5173${RESET}"
  if command -v qrencode &>/dev/null; then
    echo ""
    echo -e "  ${YELLOW}QR — rete locale:${RESET}"
    qrencode -t ANSIUTF8 "http://${LOCAL_IP}:5173"
  fi
fi
if [ -n "$TUNNEL_URL" ]; then
  echo ""
  echo -e "  ${YELLOW}🌐 Da smartphone (qualsiasi rete):${RESET}"
  echo -e "  ${GREEN}Tunnel${RESET}       → ${BOLD}${TUNNEL_URL}${RESET}"
  if command -v qrencode &>/dev/null; then
    echo ""
    echo -e "  ${YELLOW}QR — tunnel remoto:${RESET}"
    qrencode -t ANSIUTF8 "$TUNNEL_URL"
  fi
elif [ -n "$TUNNEL_PID" ]; then
  echo ""
  echo -e "  ${YELLOW}🌐 Tunnel remoto:${RESET} avviato, URL in arrivo (controlla il log sopra)"
fi
echo ""
echo -e "  ${YELLOW}Premi Ctrl+C per fermare tutti i servizi${RESET}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
