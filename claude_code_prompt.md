# Task: Automazione avvio sviluppo — Cognitive Tracking

## Contesto
Sei un agente che opera sulla codebase `cognitivetracking/`. Il tuo obiettivo è
aggiungere un sistema di avvio unificato (`make dev`) che lanci frontend, backend
e verifichi il database con un singolo comando, senza modificare la logica
applicativa esistente.

---

## Fase 1 — Ricognizione (OBBLIGATORIA, esegui prima di scrivere qualsiasi file)

Leggi questi file nell'ordine indicato e costruisci internamente un modello del
progetto:

1. `README.md` — stack, porte, comandi di avvio, variabili d'ambiente
2. `CLAUDE.md` — architettura, convenzioni, struttura directory

Poi verifica la struttura reale della repo:

```
list_directory(".")
list_directory("backend")
list_directory("frontend")
```

Controlla se esistono già questi file (non sovrascrivere se presenti):

- `Makefile` (root)
- `scripts/dev.sh`
- `scripts/` (directory)

Se `Makefile` o `scripts/dev.sh` esistono già, fermati e avvisa l'utente prima
di procedere.

---

## Fase 2 — Crea `scripts/dev.sh`

Crea la directory `scripts/` se non esiste, poi scrivi `scripts/dev.sh`.

Lo script deve seguire esattamente questa sequenza, uscendo con `exit 1` e
messaggio chiaro a ogni punto di errore:

### 2.1 — Header e variabili
- Definire colori ANSI: RESET, BOLD, RED, YELLOW, BLUE, GREEN, CYAN
- Funzioni log: `log_sys()` (giallo), `log_back()` (blu), `log_front()` (verde),
  `log_ok()` (cyan), `log_err()` (rosso su stderr)
- Ricavare `PROJECT_ROOT` dal path dello script stesso (`SCRIPT_DIR` via
  `dirname "${BASH_SOURCE[0]}"`)
- Definire: `BACKEND_DIR`, `FRONTEND_DIR`, `VENV_DIR`, `ENV_FILE`
- Inizializzare `BACKEND_PID=""` e `FRONTEND_PID=""`

### 2.2 — Trap shutdown
Registrare `trap cleanup SIGINT SIGTERM` dove `cleanup`:
- Stampa messaggio di shutdown
- Fa `kill $BACKEND_PID` e `kill $FRONTEND_PID` (silenzioso se già morti)
- Fa `wait` su entrambi i PID per evitare processi zombie
- Esce con `exit 0`

### 2.3 — Check prerequisiti
Verifica con `command -v` che siano presenti: `python3`, `node`, `npm`, `psql`,
`pg_isready`. Se uno manca, stampa hint su come installarlo con Homebrew e
termina.

### 2.4 — Check `backend/.env`
Se il file non esiste: stampa istruzioni (`cp .env.example .env` + modifica
`DATABASE_URL` e `SECRET_KEY`) e termina.
Estrai `DATABASE_URL` dal file per i check successivi.

### 2.5 — Check porte occupate
Usa `lsof -ti:<porta>` per verificare 8000 e 5173. Se occupate: mostra il PID
occupante, suggerisci `kill <pid>` o `lsof -i :<porta>` e termina.

### 2.6 — Wait-for-PostgreSQL
Estrai `DB_HOST` e `DB_PORT` da `DATABASE_URL`. Loop `pg_isready -h $DB_HOST -p
$DB_PORT -q` con sleep 1s, timeout 20 iterazioni. Se scade: mostra i comandi
`brew services start postgresql@15` e `pg_ctl start` e termina.

### 2.7 — Virtual environment Python
Se `$VENV_DIR` non esiste: `python3 -m venv "$VENV_DIR"`.
Poi: `source "$VENV_DIR/bin/activate"`.
Poi: `pip install -r "$BACKEND_DIR/requirements.txt" -q`.

### 2.8 — Migrazioni Alembic
`cd "$BACKEND_DIR" && alembic upgrade head`. Cattura l'output; se contiene
`ERROR` termina mostrando l'output.

### 2.9 — npm install (condizionale)
Se `$FRONTEND_DIR/node_modules` non esiste: `npm --prefix "$FRONTEND_DIR"
install --silent`.

### 2.10 — Avvio processi in background
Avvia backend in subshell:
```bash
(
  cd "$BACKEND_DIR"
  source "$VENV_DIR/bin/activate"
  while IFS= read -r line; do
    echo -e "${BLUE}${BOLD}[BACKEND]${RESET} $line"
  done < <(uvicorn app.main:app --reload --port 8000 2>&1)
) &
BACKEND_PID=$!
```
Sleep 2 secondi.
Avvia frontend con subshell analoga (prefisso `[FRONTEND]` verde).
Salva `FRONTEND_PID=$!`.

### 2.11 — Riepilogo e wait
Stampa box con gli URL attivi:
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173
- Istruzione "Premi Ctrl+C per fermare tutto"

Poi: `wait "$BACKEND_PID" "$FRONTEND_PID"`

Rendi eseguibile con `chmod +x scripts/dev.sh`.

---

## Fase 3 — Crea `Makefile`

Crea `Makefile` nella root del progetto. Usa `SHELL := /bin/bash`.

Target pubblici (con commento `## descrizione` per il target `help`):

| Target | Descrizione |
|--------|-------------|
| `dev` | Avvia tutto (`chmod +x scripts/dev.sh && scripts/dev.sh`) |
| `setup` | Prima configurazione: chiama `_check_prereqs _create_venv _install_deps _copy_env _npm_install` poi stampa riepilogo passi successivi |
| `migrate` | `alembic upgrade head` tramite venv |
| `seed` | `python seed.py` tramite venv |
| `migration-new` | `alembic revision --autogenerate -m "$(MSG)"` (richiede variabile `MSG`) |
| `clean` | Rimuove `__pycache__`, `*.pyc`, `*.pyo` e `/tmp/alembic_output.txt` |
| `clean-all` | Come `clean` + rimuove `venv` e `node_modules` |
| `help` | Mostra tutti i target leggendo i commenti `## ` dal Makefile stesso |

Target interni (prefisso `_`, non mostrati in `help`):
- `_check_prereqs` — verifica `python3 node npm psql` con `command -v`
- `_check_venv` — verifica esistenza `$(VENV)`
- `_check_env` — verifica esistenza `backend/.env`
- `_create_venv` — crea venv solo se non esiste
- `_install_deps` — `pip install -r requirements.txt -q`
- `_copy_env` — copia `.env.example` → `.env` solo se `.env` non esiste
- `_npm_install` — `npm install` solo se `node_modules` non esiste

Tutte le variabili (`VENV`, `PYTHON`, `PIP`, `ALEMBIC`, `BACKEND_DIR`,
`FRONTEND_DIR`) definite in cima. Usa colori ANSI negli echo (`GREEN`, `YELLOW`,
`CYAN`, `RESET`). `.DEFAULT_GOAL := help`. `.PHONY` per tutti i target.

---

## Fase 4 — Aggiorna `README.md`

Leggi il `README.md` esistente. Inserisci la seguente sezione **immediatamente
dopo il titolo H1** (`# Cognitive Tracking...`) e **prima** di qualsiasi
contenuto esistente.

Sezione da inserire:

```markdown
## ⚡ Avvio Rapido

### Prima volta (setup iniziale)

\`\`\`bash
make setup      # crea venv, installa dipendenze, copia .env.example → .env
# → modifica backend/.env con DATABASE_URL e SECRET_KEY
make migrate    # crea le tabelle
make seed       # popola stagione, gruppi e target
make dev        # avvia tutto
\`\`\`

### Avvio quotidiano

\`\`\`bash
make dev
\`\`\`

`make dev` esegue in sequenza: check prerequisiti → check .env → check porte →
wait PostgreSQL → attiva venv → pip install → `alembic upgrade head` →
avvio Uvicorn (porta 8000) → avvio Vite (porta 5173).

**Ctrl+C** ferma tutti i servizi contemporaneamente.

### Tutti i comandi

| Comando | Descrizione |
|---------|-------------|
| `make dev` | Avvia frontend + backend |
| `make setup` | Prima configurazione |
| `make migrate` | Applica migrazioni DB |
| `make seed` | Popola dati iniziali |
| `make migration-new MSG="..."` | Crea nuova migrazione Alembic |
| `make clean` | Rimuove cache Python |
| `make clean-all` | Rimuove anche venv e node_modules |
| `make help` | Mostra tutti i comandi |

### Prerequisiti macOS

\`\`\`bash
brew install python node postgresql@15
brew services start postgresql@15
createdb cognitive_tracking   # solo prima volta
\`\`\`

---
```

Non modificare il resto del README.

---

## Fase 5 — Verifica finale

Dopo aver creato tutti i file, esegui questi controlli e riporta i risultati:

```bash
bash -n scripts/dev.sh          # check sintattico bash
make -n dev 2>&1 | head -5      # dry-run make dev
```

Verifica anche:
- `scripts/dev.sh` ha permessi eseguibili (`-rwxr-xr-x`)
- `Makefile` è nella root del progetto
- `README.md` contiene la sezione "Avvio Rapido" prima di "Stack tecnologico"

---

## Vincoli assoluti

- NON modificare nessun file in `backend/app/`, `frontend/src/`, `alembic/`
- NON modificare `requirements.txt`, `package.json` esistenti
- NON introdurre dipendenze npm aggiuntive
- NON sovrascrivere `Makefile` o `scripts/dev.sh` se già esistono — chiedi prima
- Il contenuto originale del `README.md` deve rimanere invariato (solo aggiunta)
- `Ctrl+C` deve sempre terminare tutti i processi figli senza zombie
- Lo script deve funzionare con PostgreSQL locale (non containerizzato)
- Rispondi in italiano nel riepilogo finale

---

## Output atteso a fine esecuzione

```
✅ scripts/dev.sh creato (eseguibile)
✅ Makefile creato nella root
✅ README.md aggiornato con sezione "Avvio Rapido"
✅ Sintassi bash: OK
✅ make -n dev: OK

Prossimi passi per l'utente:
1. Modifica backend/.env con DATABASE_URL e SECRET_KEY
2. Esegui: make migrate && make seed
3. Esegui: make dev
```