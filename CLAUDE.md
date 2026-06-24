# ARCHITECTURE & CONTEXT - Cognitive Tracking

## 1. Stack Tecnologico
- **Frontend:** React 18 (Vite), Tailwind CSS, React Router v6, Axios, Recharts (grafici), jsPDF/html2canvas (export), idb (IndexedDB).
- **Backend:** FastAPI (Python), Pydantic v2 (validazione/settings), Uvicorn, slowapi (rate limiting), GZipMiddleware.
- **Database:** PostgreSQL 15+ con SQLAlchemy 2.0 (ORM asincrono/sincrono, Mapped types) e Alembic (migrazioni). RLS abilitato su tutte le tabelle public.
- **Auth:** JWT (python-jose) con bcrypt. Utenti in `backend/users.json` (gitignored); ruoli embedded nel token, zero DB hit per request.

## 2. Struttura del Progetto (High-Level)
- `/frontend/src/`: SPA React. `pages/` gestiscono le viste, `context/AuthContext` gestisce lo stato auth, `layouts/MainLayout` il guscio UI.
- `/backend/app/`: API strutturata.
  - `routers/`: Endpoint API divisi per dominio (`auth`, `groups`, `players`, `seasons`, `sessions`).
  - `models/`: Modelli SQLAlchemy (`player`, `group`, `season`, `training_session`, `measurement`, `observation_event`, `assignment`, `group_target`, `group_change_log`).
  - `schemas/`: Modelli Pydantic per validazione input/output.
  - `services/`: Logica di business (`auth_service`, `group_service`, `player_service`, `season_service`, `session_service`, `observation_service`).
  - `rbac.py`: Guards FastAPI (`require_admin`, `require_staff`, `require_auth`, `assert_group_access`, `assert_write_access`).
  - `user_store.py`: Carica `users.json` a startup, dict in-memory; password bcrypt.
  - `config.py`: Gestione variabili d'ambiente tramite `pydantic-settings`.
- `/backend/tests/`: Test suite (pytest) — conftest + test per ogni dominio.
- `/frontend/src/api/`: Client HTTP centralizzato (`axios.js` con interceptor, + un file per dominio: `auth`, `groups`, `players`, `seasons`, `sessions`, `events`).
- `/frontend/src/hooks/`: Custom hooks per report (`usePlayerReport`, `useTeamReport`, `useSessionPlayerReport`, `useSessionTeamReport`) e utils (`useOnlineStatus`).
- `/frontend/src/constants/domain.js`: Costanti di dominio (`COGNITIVE_PARAMS`, `SESSION_TYPES`, `METRIC_EVENT_CONFIG`).

## 3. Flusso dei Dati Principale
1. **Autenticazione:** L'utente fa login tramite `/api/auth/login`, riceve un JWT che salva nel browser.
2. **Struttura Gerarchica:** I dati sono organizzati in `Season` (Stagione) -> `Group` (Squadra/Gruppo) -> `Player` (Giocatore). I giocatori sono assegnati ai gruppi tramite `PlayerGroupAssignment`.
3. **Tracking:** Viene creata una `TrainingSession` per un gruppo. Per ogni giocatore della sessione, viene inserito un record `Measurement` con parametri cognitivi specifici (scanning rate, decision quality, anticipation, transition reset, verbal_comm).
4. **Report:** I dati aggregati delle `Measurement` vengono confrontati con i `GroupTarget` (obiettivi) per generare report PDF (Player/Team Report) usando Recharts e jsPDF.

## 4. Pattern di Codice e Convenzioni
- **Backend:**
  - Router thin: delegano la logica ai Service layer; solo routing + risposta HTTP nei router.
  - UUID v4 come Primary Key su tutti i modelli.
  - Dipendenze FastAPI (`Depends(get_db)`, `Depends(get_current_user)`) per iniettare sessioni DB e proteggere le rotte.
  - Configurazione centralizzata in `app.config.Settings` caricata da `.env`.
  - **RBAC:** ruoli (`admin`, `responsabile_tecnico`, `allenatore`) embedded nel JWT. Guards: `Depends(require_admin)`, `Depends(require_staff)`, `Depends(require_auth)`. Data scoping: `current_user.read_scope()` → `None` (vede tutto) o `set[UUID]` (solo propri gruppi per `allenatore`). `assert_group_access` / `assert_write_access` per autorizzazioni fine-grained.
  - **Error handling centralizzato:** `main.py` ha `@exception_handler` per `RequestValidationError` (422), `IntegrityError` (409), `OperationalError` (503). Risposte JSON strutturate coerenti.
  - **Rate limiting:** slowapi su endpoint sensibili (es. login).
  - **Pagination:** limite massimo 200 per list endpoint (`/players`, `/sessions`, `/rankings`); 500 per `/players/{id}/history`.
- **Frontend:**
  - Routing protetto tramite `<ProtectedRoute />` che verifica il token JWT.
  - API client basato su Axios (ancora distribuito nelle pagine — vedi Sezione 5).
  - `SessionDetailPage`: dirty tracking + `useBlocker` (dialog navigazione in-app) + `beforeunload` per evitare perdita dati.

## 5. 🚀 Opportunità di Sviluppo e Refactoring (Pendenti)

- **Cosa:** Ottimizzazione Query per i Report.
  - **Dove:** `backend/app/services/session_service.py` / `group_service.py`.
  - **Impatto:** Medio.
  - **Azione suggerita:** Per le pagine di report (es. `TeamReportPage`), le query che aggregano le `Measurements` storiche potrebbero diventare lente. Utilizzare funzioni di aggregazione SQL (`func.avg()`, `func.sum()`) a livello di DB invece di caricare tutti i record in memoria Python.

## Observation events (metriche cognitive)
- Modello **per-evento** (`observation_events`, append-only); salvataggio batch idempotente (delete-per-pair + insert), non upsert.
- Derivazione: `normalized_score`/`reliability_flag` pure su scalari; aggrega (SUM righe) **poi** deriva.
- Reliability `n`: SR = COUNT righe (ricezioni); DQI/TRS/VCI = `denominator`; AI = `numerator`. SR `min_n=6`; gate pubblicazione ≥ medium.
- Ogni dato porta `codebook_version`; definizioni in `docs/codebook/codebook-v1.md` (congelate dal primo dato reale).
- Validazione di dominio in Pydantic, niente CHECK/ENUM nel DB.
- **Dettaglio, decisioni, invarianti e fili aperti:** [`docs/dev/observation-events.md`](docs/dev/observation-events.md) — leggilo prima di modificare questo sottosistema.