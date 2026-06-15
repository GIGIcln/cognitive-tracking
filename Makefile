# =============================================================================
#  Cognitive Tracking — Makefile
#  Uso: make <target>
#  Richiede: Python 3, Node.js, PostgreSQL (installati su macOS)
# =============================================================================

.PHONY: dev setup migrate seed clean help

SHELL := /bin/bash
BACKEND_DIR := backend
FRONTEND_DIR := frontend
VENV         := $(BACKEND_DIR)/.venv
PYTHON       := $(VENV)/bin/python
PIP          := $(VENV)/bin/pip
ALEMBIC      := $(VENV)/bin/alembic

# Colori per output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
RESET  := \033[0m

# =============================================================================
#  TARGET PRINCIPALE
# =============================================================================

## dev: Avvia frontend + backend + check DB con un solo comando
dev:
	@chmod +x scripts/dev.sh
	@scripts/dev.sh

# =============================================================================
#  SETUP PRIMA CONFIGURAZIONE
# =============================================================================

## setup: Prima configurazione completa (venv, dipendenze, .env, npm install)
setup: _check_prereqs _create_venv _install_deps _copy_env _npm_install
	@echo ""
	@echo -e "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo -e "$(GREEN)  ✅ Setup completato!$(RESET)"
	@echo ""
	@echo -e "  Prossimi passi:"
	@echo -e "  $(YELLOW)1.$(RESET) Modifica $(YELLOW)$(BACKEND_DIR)/.env$(RESET) con DATABASE_URL e SECRET_KEY"
	@echo -e "  $(YELLOW)2.$(RESET) Esegui $(YELLOW)make migrate$(RESET) per creare le tabelle"
	@echo -e "  $(YELLOW)3.$(RESET) Esegui $(YELLOW)make seed$(RESET) per popolare dati iniziali"
	@echo -e "  $(YELLOW)4.$(RESET) Esegui $(YELLOW)make dev$(RESET) per avviare l'app"
	@echo -e "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo ""

# =============================================================================
#  DATABASE
# =============================================================================

## migrate: Esegue alembic upgrade head (applica tutte le migrazioni)
migrate: _check_env _check_venv
	@echo -e "$(YELLOW)[MIGRATE]$(RESET) Esecuzione alembic upgrade head..."
	@cd $(BACKEND_DIR) && $(ALEMBIC) upgrade head
	@echo -e "$(GREEN)[OK]$(RESET) Migrazioni completate"

## seed: Popola il database con stagione, gruppi e target iniziali
seed: _check_env _check_venv
	@echo -e "$(YELLOW)[SEED]$(RESET) Esecuzione seed.py..."
	@cd $(BACKEND_DIR) && $(PYTHON) seed.py
	@echo -e "$(GREEN)[OK]$(RESET) Seed completato"

## migration-new: Crea una nuova migrazione Alembic (uso: make migration-new MSG="descrizione")
migration-new: _check_env _check_venv
	@[ -n "$(MSG)" ] || (echo "Errore: specifica MSG. Uso: make migration-new MSG=\"descrizione\"" && exit 1)
	@echo -e "$(YELLOW)[MIGRATE]$(RESET) Creazione nuova migrazione: $(MSG)"
	@cd $(BACKEND_DIR) && $(ALEMBIC) revision --autogenerate -m "$(MSG)"

# =============================================================================
#  PULIZIA
# =============================================================================

## clean: Rimuove cache Python e file temporanei (non tocca venv né node_modules)
clean:
	@echo -e "$(YELLOW)[CLEAN]$(RESET) Rimozione cache Python..."
	@find . -type d -name __pycache__ -not -path "./.git/*" -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -not -path "./.git/*" -delete 2>/dev/null || true
	@find . -name "*.pyo" -not -path "./.git/*" -delete 2>/dev/null || true
	@rm -f /tmp/alembic_output.txt
	@echo -e "$(GREEN)[OK]$(RESET) Pulizia completata"

## clean-all: Rimuove anche venv e node_modules (reinstallazione completa)
## stop: Forza lo stop di backend e frontend (se rimasti zombie dopo chiusura terminale)
stop:
	@echo -e "$(YELLOW)[STOP]$(RESET) Arresto processi su porta 8000 e 5173..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null && echo -e "$(GREEN)[OK]$(RESET) Backend fermato" || echo "Nessun processo su 8000"
	@lsof -ti:5173 | xargs kill -9 2>/dev/null && echo -e "$(GREEN)[OK]$(RESET) Frontend fermato" || echo "Nessun processo su 5173"

clean-all: clean
	@echo -e "$(YELLOW)[CLEAN]$(RESET) Rimozione venv e node_modules..."
	@rm -rf $(VENV)
	@rm -rf $(FRONTEND_DIR)/node_modules
	@echo -e "$(GREEN)[OK]$(RESET) Pulizia completa. Esegui 'make setup' per reinstallare."

# =============================================================================
#  HELP
# =============================================================================

## help: Mostra questo messaggio di aiuto
help:
	@echo ""
	@echo -e "$(CYAN)Cognitive Tracking — Comandi disponibili:$(RESET)"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | \
	  awk -F': ' '{printf "  $(YELLOW)make %-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help

# =============================================================================
#  TARGET INTERNI (prefisso _ = non mostrati in help)
# =============================================================================

_check_prereqs:
	@echo -e "$(YELLOW)[CHECK]$(RESET) Verifica prerequisiti..."
	@command -v python3 &>/dev/null || (echo "❌ python3 non trovato. Installa con: brew install python" && exit 1)
	@command -v node    &>/dev/null || (echo "❌ node non trovato. Installa con: brew install node" && exit 1)
	@command -v npm     &>/dev/null || (echo "❌ npm non trovato. Installato con Node.js" && exit 1)
	@command -v psql    &>/dev/null || (echo "❌ psql non trovato. Installa con: brew install postgresql@15" && exit 1)
	@echo -e "$(GREEN)[OK]$(RESET) Tutti i prerequisiti presenti"

_check_venv:
	@[ -d "$(VENV)" ] || (echo "❌ Virtual environment non trovato. Esegui: make setup" && exit 1)

_check_env:
	@[ -f "$(BACKEND_DIR)/.env" ] || \
	  (echo "❌ $(BACKEND_DIR)/.env non trovato. Esegui: make setup" && exit 1)

_create_venv:
	@if [ ! -d "$(VENV)" ]; then \
	  echo -e "$(YELLOW)[SETUP]$(RESET) Creazione virtual environment Python..."; \
	  python3 -m venv $(VENV); \
	  echo -e "$(GREEN)[OK]$(RESET) Virtual environment creato in $(VENV)"; \
	else \
	  echo -e "$(GREEN)[OK]$(RESET) Virtual environment già presente"; \
	fi

_install_deps: _create_venv
	@echo -e "$(YELLOW)[SETUP]$(RESET) Installazione dipendenze Python..."
	@$(PIP) install -r $(BACKEND_DIR)/requirements.txt -q
	@echo -e "$(GREEN)[OK]$(RESET) Dipendenze Python installate"

_copy_env:
	@if [ ! -f "$(BACKEND_DIR)/.env" ]; then \
	  if [ -f "$(BACKEND_DIR)/.env.example" ]; then \
	    cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
	    echo -e "$(YELLOW)[SETUP]$(RESET) Creato $(BACKEND_DIR)/.env da .env.example"; \
	    echo -e "$(YELLOW)  ⚠️  Modifica DATABASE_URL e SECRET_KEY prima di avviare!$(RESET)"; \
	  else \
	    echo -e "$(YELLOW)[WARN]$(RESET) .env.example non trovato — crea manualmente $(BACKEND_DIR)/.env"; \
	  fi \
	else \
	  echo -e "$(GREEN)[OK]$(RESET) $(BACKEND_DIR)/.env già presente"; \
	fi

_npm_install:
	@if [ ! -d "$(FRONTEND_DIR)/node_modules" ]; then \
	  echo -e "$(YELLOW)[SETUP]$(RESET) Installazione npm packages..."; \
	  npm --prefix $(FRONTEND_DIR) install --silent; \
	  echo -e "$(GREEN)[OK]$(RESET) npm packages installati"; \
	else \
	  echo -e "$(GREEN)[OK]$(RESET) node_modules già presente"; \
	fi
