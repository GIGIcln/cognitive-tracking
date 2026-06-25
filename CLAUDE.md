# ARCHITECTURE & CONTEXT - Gestionale Sportivo

> Il progetto sta evolvendo da cognitive tracking a **gestionale sportivo completo**. Il modulo cognitivo rimane, integrato nella sezione Allenamenti. I nuovi moduli (Rosa estesa, Partite, Presenze, Impostazioni gruppo) vengono aggiunti iterativamente. Vedi TECHNICAL_ROADMAP.md per la sequenza.

## 1. Stack Tecnologico
- **Frontend:** React 18 (Vite), Tailwind CSS, React Router v6, Axios, Recharts (grafici), jsPDF/html2canvas (export), idb (IndexedDB).
- **Backend:** FastAPI (Python), Pydantic v2 (validazione/settings), Uvicorn, slowapi (rate limiting), GZipMiddleware.
- **Database:** PostgreSQL 15+ con SQLAlchemy 2.0 (ORM asincrono/sincrono, Mapped types) e Alembic (migrazioni). RLS abilitato su tutte le tabelle public.
- **Auth:** JWT (python-jose) con bcrypt. Utenti in tabella `users` PostgreSQL (`UserService` + `GET/POST/PATCH/DELETE /api/users`). `users.json` usato solo come seed locale in sviluppo. Gli allenatori si auto-registrano via `POST /api/auth/register` (stato `pending` finché l'admin attiva l'account); i responsabili tecnici vengono creati dall'admin. Ruoli embedded nel token, zero DB hit per request.

## 2. Navigazione e Struttura UI

### Voci di navigazione per ruolo

| Sezione | Admin | Resp. tecnico | Allenatore |
|---|---|---|---|
| Home (dashboard role-specific) | ✓ | ✓ | ✓ |
| Rosa (giocatori, anagrafica, report) | ✓ | ✓ | solo gruppo assegnato |
| Allenamenti (sessioni, cognitivo, presenze, report) | ✓ | ✓ | solo gruppo assegnato |
| Partite (calendario gare, risultati, report) | ✓ | ✓ | solo gruppo assegnato |
| Stagioni | ✓ | ✓ | — |
| Impostazioni | tutto | profilo | giorni allenamento, config gruppo |

I **report sono interni a ogni sezione**, non esiste una voce "Report" separata nella nav.

### Struttura del Progetto (High-Level)
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
  - **RBAC:** ruoli (`admin`, `responsabile_tecnico`, `allenatore`) embedded nel JWT. Guards: `Depends(require_admin)`, `Depends(require_staff)`, `Depends(require_auth)`. Regole di permesso:
    - `admin`: legge e scrive tutto.
    - `responsabile_tecnico`: **legge tutto, nessuna scrittura**.
    - `allenatore`: legge e scrive **solo il proprio gruppo assegnato**.
    - **Doppio ruolo** (`allenatore` + `responsabile_tecnico`): read scope = `None` (il ruolo responsabile prevale), write scope = solo gruppo assegnato (il ruolo allenatore governa la scrittura).
    - Data scoping: `current_user.read_scope()` → `None` se ha `responsabile_tecnico` o `admin`, altrimenti `set[UUID]` dei gruppi assegnati. `assert_group_access` / `assert_write_access` per autorizzazioni fine-grained.
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

## 6. Nuovi Moduli in Sviluppo (Gestionale)

I moduli seguenti sono pianificati nell'ordine indicato. Ogni modulo segue il solito flusso: migrazione → modello → schema → service → router → frontend.

| Modulo | Stato | Note |
|---|---|---|
| **GS-01** Migrazione auth su DB + registrazione allenatori | ✅ completato | `users` table, `/auth/register`, `UsersAdminPage` |
| **GS-02** Pannello admin utenti (assegnazione ruoli/gruppi) | ✅ completato | `/impostazioni/utenti`, CRUD `/api/users` |
| **GS-03** Anagrafica giocatore estesa | ✅ completato | Dati personali, ruolo tattico, documenti |
| **GS-04** Modulo Presenze | ✅ completato | Attendance per sessione, giustificazioni |
| **GS-05** Modulo Partite | ✅ completato | Gare, risultati, formazioni, minutaggi |
| **GS-06** Impostazioni gruppo (allenatore) | ✅ completato | Gate modalità punteggio in SessionDetailPage |
| **GS-07** Infortuni & disponibilità | ✅ completato | InjuryLog, stato rosa, badge disponibilità |
| **GS-08** UI redesign: context bar + layout allargato | ✅ completato | SeasonGroupContext + sidebar collassabile + bottom nav mobile |

## Observation events (metriche cognitive)
- Modello **per-evento** (`observation_events`, append-only); salvataggio batch idempotente (delete-per-pair + insert), non upsert.
- Derivazione: `normalized_score`/`reliability_flag` pure su scalari; aggrega (SUM righe) **poi** deriva.
- Reliability `n`: SR = COUNT righe (ricezioni); DQI/TRS/VCI = `denominator`; AI = `numerator`. SR `min_n=6`; gate pubblicazione ≥ medium.
- Ogni dato porta `codebook_version`; definizioni in `docs/codebook/codebook-v1.md` (congelate dal primo dato reale).
- Validazione di dominio in Pydantic, niente CHECK/ENUM nel DB.
- **Dettaglio, decisioni, invarianti e fili aperti:** [`docs/dev/observation-events.md`](docs/dev/observation-events.md) — leggilo prima di modificare questo sottosistema.