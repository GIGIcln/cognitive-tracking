# ARCHITECTURE & CONTEXT - Cognitive Tracking

## 1. Stack Tecnologico
- **Frontend:** React 18 (Vite), Tailwind CSS, React Router v6, Axios, Recharts (grafici), jsPDF/html2canvas (export), idb (IndexedDB).
- **Backend:** FastAPI (Python), Pydantic v2 (validazione/settings), Uvicorn.
- **Database:** PostgreSQL 15+ con SQLAlchemy 2.0 (ORM asincrono/sincrono, Mapped types) e Alembic (migrazioni).
- **Auth:** JWT (python-jose) con bcrypt.

## 2. Struttura del Progetto (High-Level)
- `/frontend/src/`: SPA React. `pages/` gestiscono le viste, `context/AuthContext` gestisce lo stato auth, `layouts/MainLayout` il guscio UI.
- `/backend/app/`: API strutturata.
  - `routers/`: Endpoint API (controllers) divisi per dominio (`auth`, `groups`, `players`, `sessions`).
  - `models/`: Modelli SQLAlchemy (tabelle DB).
  - `schemas/`: Modelli Pydantic per validazione input/output.
  - `services/`: Logica di business (attualmente contiene `auth_service`).
  - `config.py`: Gestione variabili d'ambiente tramite `pydantic-settings`.

## 3. Flusso dei Dati Principale
1. **Autenticazione:** L'utente fa login tramite `/api/auth/login`, riceve un JWT che salva nel browser.
2. **Struttura Gerarchica:** I dati sono organizzati in `Season` (Stagione) -> `Group` (Squadra/Gruppo) -> `Player` (Giocatore). I giocatori sono assegnati ai gruppi tramite `PlayerGroupAssignment`.
3. **Tracking:** Viene creata una `TrainingSession` per un gruppo. Per ogni giocatore della sessione, viene inserito un record `Measurement` con parametri cognitivi specifici (scanning rate, decision quality, anticipation, transition reset, verbal_comm).
4. **Report:** I dati aggregati delle `Measurement` vengono confrontati con i `GroupTarget` (obiettivi) per generare report PDF (Player/Team Report) usando Recharts e jsPDF.

## 4. Pattern di Codice e Convenzioni
- **Backend:** 
  - I Router gestiscono sia il routing che l'esecuzione diretta delle query SQLAlchemy (attualmente).
  - Uso massiccio di UUID v4 come Primary Key per tutti i modelli.
  - Le dipendenze FastAPI (`Depends(get_db)`, `Depends(get_current_user)`) sono usate per iniettare sessioni DB e proteggere le rotte.
  - Configurazione centralizzata in `app.config.Settings` caricata da `.env`.
- **Frontend:**
  - Routing protetto tramite `<ProtectedRoute />` che verifica il token JWT.
  - API client basato su Axios.

## 5. 🚀 Opportunità di Sviluppo e Refactoring (High Priority)

- **Cosa:** Separazione della logica di business (Service Layer).
  - **Dove:** `backend/app/routers/*.py` (es. `players.py`, `groups.py`).
  - **Impatto:** Alto.
  - **Azione suggerita:** Attualmente i router contengono query SQL complesse (es. join per recuperare il gruppo corrente di un player). Spostare queste query e la logica di validazione in `backend/app/services/` per mantenere i router puliti e testabili.

- **Cosa:** Centralizzazione delle chiamate API nel Frontend.
  - **Dove:** `frontend/src/pages/` e `frontend/src/services/`.
  - **Impatto:** Medio.
  - **Azione suggerita:** Creare un client Axios centralizzato (`api.js`) con un intercettore per iniettare automaticamente il JWT e gestire i 401 (redirect al login). Creare Custom Hooks (`useGroups`, `usePlayers`) per astrarre il fetching dei dati dalle pagine.

- **Cosa:** Gestione centralizzata degli errori (Error Handling).
  - **Dove:** `backend/app/main.py`.
  - **Impatto:** Alto.
  - **Azione suggerita:** Aggiungere un middleware globale FastAPI (`@app.exception_handler`) per catturare le eccezioni (es. `IntegrityError` del DB, `ValidationError`) e restituire risposte JSON strutturate e coerenti al frontend.

- **Cosa:** Ottimizzazione Query per i Report.
  - **Dove:** `backend/app/routers/sessions.py` / `groups.py`.
  - **Impatto:** Medio.
  - **Azione suggerita:** Per le pagine di report (es. `TeamReportPage`), le query che aggregano le `Measurements` storiche potrebbero diventare lente. Utilizzare funzioni di aggregazione SQL (es. `func.avg()`, `func.sum()`) a livello di DB invece di caricare tutti i record in memoria Python.

## Observation events (metriche cognitive)
- Modello **per-evento** (`observation_events`, append-only); salvataggio batch idempotente (delete-per-pair + insert), non upsert.
- Derivazione: `normalized_score`/`reliability_flag` pure su scalari; aggrega (SUM righe) **poi** deriva.
- Reliability `n`: SR = COUNT righe (ricezioni); DQI/TRS/VCI = `denominator`; AI = `numerator`. SR `min_n=6`; gate pubblicazione ≥ medium.
- Ogni dato porta `codebook_version`; definizioni in `docs/codebook/codebook-v1.md` (congelate dal primo dato reale).
- Validazione di dominio in Pydantic, niente CHECK/ENUM nel DB.
- **Dettaglio, decisioni, invarianti e fili aperti:** [`docs/dev/observation-events.md`](docs/dev/observation-events.md) — leggilo prima di modificare questo sottosistema.