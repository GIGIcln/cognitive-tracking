# REPO_ARCHITECTURE.md — Mappa del Progetto Gestionale Sportivo

> Il progetto è in transizione da cognitive tracking a gestionale sportivo completo. Il modulo cognitivo è integrato nella sezione Allenamenti. I nuovi moduli vengono aggiunti iterativamente — vedi TECHNICAL_ROADMAP.md sezione GS-*.

> Documento di riferimento architetturale. Aggiornalo ad ogni decisione strutturale significativa.

---

## 1. Stack Tecnologico & Dipendenze

### Backend (`/backend`)

| Libreria | Versione minima | Scopo |
|---|---|---|
| **FastAPI** | 0.111.0 | Framework HTTP asincrono; gestisce routing, validazione, OpenAPI |
| **Uvicorn** | 0.30.1 | ASGI server con standard extras (HTTP/1.1 + WebSocket) |
| **SQLAlchemy** | 2.0.31 | ORM sincrono con `Mapped`/`mapped_column` (stile 2.0 dichiarativo) |
| **Alembic** | 1.13.2 | Gestione migrazioni database con autogenerate |
| **psycopg2-binary** | 2.9.9 | Driver PostgreSQL per SQLAlchemy (sync) |
| **Pydantic v2** | 2.8.2 | Validazione input/output e settings (`pydantic-settings`) |
| **python-jose** | 3.3.0 | Firma/verifica JWT (algoritmo HS256) |
| **bcrypt** | 4.0.1 | Hashing password (versione pinnata per compatibilità) |
| **slowapi** | 0.1.9 | Rate limiting per FastAPI (basato su limiti per IP) |
| **pytest-postgresql** | 8.0.0 | Test di integrazione con database PostgreSQL reale (no mock) |

### Frontend (`/frontend`)

| Libreria | Versione minima | Scopo |
|---|---|---|
| **React** | 18.3.1 | UI library con concurrent features |
| **Vite** | 5.4.1 | Build tool e dev server (ES modules nativi) |
| **Tailwind CSS** | 3.4.19 | CSS utility-first; nessun CSS custom — solo classi Tailwind |
| **React Router v6** | 6.26.1 | Routing client-side con layout annidati |
| **Axios** | 1.7.4 | HTTP client con interceptor centralizzati |
| **Recharts** | 2.12.7 | Grafici SVG dichiarativi (RadarChart, LineChart, BarChart) |
| **jsPDF + html2canvas** | 2.5.2 / 1.4.1 | Generazione report PDF via canvas snapshot |
| **idb** | 8.0.0 | Wrapper tipizzato per IndexedDB (offline queue) |
| **papaparse** | 5.4.1 | Parsing CSV per import bulk giocatori |
| **lucide-react** | 1.20.0 | Icone SVG come componenti React |
| **vite-plugin-pwa** | 1.3.0 | Service Worker e manifest per Progressive Web App |
| **vitest + @testing-library/react** | — | Test unitari e di componenti |

### Database
- **PostgreSQL 15+** — unico datastore, accesso sincrono via SQLAlchemy connection pool

---

## 2. Architettura del Sistema

### Pattern: Layered Monorepo

```
┌─────────────────────────────────────────────────────┐
│  Browser (SPA React)                                │
│  React Router → Pages → Custom Hooks → API clients │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/JSON (cookie HttpOnly + CORS)
┌──────────────────────▼──────────────────────────────┐
│  FastAPI (Uvicorn)                                  │
│  Middleware stack → Routers → Services → ORM        │
└──────────────────────┬──────────────────────────────┘
                       │ SQLAlchemy (sync, connection pool)
┌──────────────────────▼──────────────────────────────┐
│  PostgreSQL 15 (RLS abilitata su tutte le tabelle)  │
│  15 migrazioni Alembic (0001 → 0015)                │
└─────────────────────────────────────────────────────┘
```

### Data Flow: dalla UI al DB

```
1. Utente interagisce con un componente React (es. SessionDetailPage)
2. Custom hook (es. useSessionTeamReport) chiama il modulo API client (api/sessions.js)
3. Axios (con cookie HttpOnly ct_token) invia la request al backend
4. Middleware chain:
   _RequestID → _LimitUploadSize → GZipMiddleware → CORSMiddleware → SlowAPI
5. Router FastAPI verifica il JWT via get_current_user() (lookup in-memory su users.json)
6. Guard RBAC: require_auth / require_admin / assert_group_access
7. Service layer (es. SessionService) esegue le query SQLAlchemy
8. Schema Pydantic serializza la risposta
9. Custom hook aggiorna lo state React
10. Componenti ri-renderizzano con i nuovi dati
```

### Flusso Autenticazione

```
Login → POST /api/auth/login
  → bcrypt.checkpw (password vs hash in users.json)
  → JWT generato con { sub, roles, group_ids, exp }
  → Cookie HttpOnly "ct_token" impostato nella response
  
Ogni request autenticata:
  → get_current_user() legge il cookie (fallback: Bearer header)
  → jwt.decode() verifica firma e scadenza
  → user_store.get_by_id() O(1) lookup in-memory
  → UserContext costruito (nessuna query DB)
```

### Gerarchia dei Dati

```
Season (stagione sportiva)
└── Group (squadra/categoria, appartiene a una Season)
    ├── PlayerGroupAssignment (M2M con audit trail)
    │   └── Player (anagrafica, cross-season)
    ├── GroupTarget (obiettivi cognitivi per gruppo)
    ├── GroupChangeLog (log spostamenti giocatori)
    └── TrainingSession (allenamento)
        ├── Measurement (punteggi 1-10 per giocatore, derivati)
        └── ObservationEvent (eventi raw per-riga, append-only)
```

---

## 3. Struttura delle Directory

### Root

```
gestionale/
├── backend/           # API FastAPI + logica di business
├── frontend/          # SPA React + build Vite
├── docs/              # Documentazione tecnica e codebook
│   ├── codebook/      # codebook-v1.md (definizioni metriche congelate)
│   └── dev/           # Note di sviluppo (observation-events.md, etc.)
├── scripts/           # Utility Python (hash_password.py, dev.sh)
├── Makefile           # Entry point unico per setup, dev, migrate, seed
├── CLAUDE.md          # Istruzioni per Claude Code (invarianti del progetto)
└── DOCUMENTATION.md   # Documentazione utente
```

### Backend (`/backend/app/`)

```
app/
├── main.py            # Entry point FastAPI: middleware, exception handlers, router mount
├── config.py          # Settings pydantic-settings (lru_cache, validazione SECRET_KEY)
├── database.py        # Engine SQLAlchemy, SessionLocal, get_db() dependency
├── rbac.py            # Guard RBAC: require_admin, require_staff, require_auth,
│                      # assert_group_access, assert_write_access
├── user_store.py      # Cache in-memory di users.json (thread-safe con Lock)
├── limiter.py         # Istanza SlowAPI (rate limiting per IP)
│
├── models/            # Modelli SQLAlchemy (tabelle DB)
│   ├── base.py        # DeclarativeBase comune
│   ├── season.py      # Season
│   ├── group.py       # Group (con relationships a Season, Player, Session)
│   ├── player.py      # Player (anagrafica cross-season)
│   ├── assignment.py  # PlayerGroupAssignment (M2M con start/end_date)
│   ├── group_target.py        # Obiettivi cognitivi per gruppo
│   ├── group_change_log.py    # Audit log spostamenti giocatori
│   ├── training_session.py    # Sessione di allenamento
│   ├── measurement.py         # Punteggi derivati (1-10, Numeric 4,1)
│   └── observation_event.py   # Evento raw (append-only, per-riga)
│
├── schemas/           # Modelli Pydantic (input/output API)
│   ├── auth.py        # UserContext, LoginRequest, TokenResponse
│   ├── season.py      # SeasonCreate, SeasonResponse
│   ├── group.py       # GroupCreate, GroupResponse, TargetResponse
│   ├── player.py      # PlayerCreate, PlayerResponse, BulkAssignRequest
│   ├── session.py     # SessionCreate, MeasurementsBatchInput, SessionAveragesResponse
│   ├── observation_event.py   # ObservationEventsBatchInput, ObservationEventResponse
│   └── pagination.py  # Page[T] generico (items, total, skip, limit)
│
├── routers/           # Controller HTTP (routing + wiring, logica minima)
│   ├── auth.py        # POST /auth/login, GET /auth/me, POST /auth/logout
│   ├── seasons.py     # CRUD seasons, gestione is_current
│   ├── groups.py      # CRUD groups, targets, history, bulk assign
│   ├── players.py     # CRUD players, assegnazioni, streak
│   └── sessions.py    # CRUD sessions, measurements, observation events, rankings
│
└── services/          # Logica di business (testabile, indipendente da HTTP)
    ├── auth_service.py          # JWT encoding/decoding, bcrypt, get_current_user
    ├── season_service.py        # Logica stagione corrente
    ├── group_service.py         # Query gruppi con eager loading
    ├── player_service.py        # Streak, storia assegnazioni
    ├── session_service.py       # Averages (func.avg), rankings, upsert measurements
    └── observation_service.py   # Batch idempotente, aggregazione eventi, write-back score
```

### Frontend (`/frontend/src/`)

```
src/
├── main.jsx           # Entry point: BrowserRouter + App
├── App.jsx            # Route tree: lazy loading pagine pesanti
│
├── api/               # Client HTTP per dominio (un file per router backend)
│   ├── axios.js       # Istanza Axios centralizzata: withCredentials, interceptor 401,
│   │                  # offline queue per POST/PUT/PATCH senza connessione
│   ├── auth.js        # login(), getMe(), logout()
│   ├── seasons.js     # getSeasons(), createSeason(), etc.
│   ├── groups.js      # getGroups(), getGroupHistory(), getGroupTargets(), etc.
│   ├── players.js     # getPlayers(), assignPlayer(), getBulkAssign(), etc.
│   ├── sessions.js    # getSessions(), getMeasurements(), upsertEvents(), etc.
│   └── events.js      # getEvents(), upsertEvents() (observation events)
│
├── context/
│   ├── AuthContext.jsx        # user, isLoading, login(), logout(), isAdmin
│   └── OfflineContext.jsx     # stato connessione + coda sync + syncError
│
├── hooks/             # Custom hooks per data fetching con state
│   ├── useTeamReport.js       # Dati per TeamReportPage (group + history + targets)
│   ├── usePlayerReport.js     # Dati per PlayerReportPage (player + measurements)
│   ├── useSessionTeamReport.js
│   ├── useSessionPlayerReport.js
│   └── useOnlineStatus.js     # navigator.onLine + eventi online/offline
│
├── pages/             # Una pagina = una route
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── GroupsPage.jsx / GroupDetailPage.jsx
│   ├── PlayersPage.jsx / PlayerDetailPage.jsx
│   ├── SessionsPage.jsx / SessionDetailPage.jsx
│   ├── ReportsPage.jsx
│   ├── PlayerReportPage.jsx / TeamReportPage.jsx
│   ├── SessionTeamReportPage.jsx / SessionPlayerReportPage.jsx
│   └── SeasonsPage.jsx
│
├── components/        # Componenti riutilizzabili
│   ├── ProtectedRoute.jsx     # Redirect al login se !user
│   ├── ErrorBoundary.jsx      # Catch errori React non gestiti
│   ├── OfflineBanner.jsx      # Banner quando offline + stato coda
│   ├── ParamCard.jsx          # Card parametro cognitivo (score + grafico)
│   ├── ScoreWidget.jsx        # Widget punteggio con colore
│   └── ToggleSwitch.jsx       # Toggle UI generico
│
├── layouts/
│   └── MainLayout.jsx         # Shell UI: sidebar, header, <Outlet />
│
├── constants/
│   └── domain.js      # COGNITIVE_PARAMS, SESSION_TYPES, POSITIONS, METRIC_EVENT_CONFIG
│
└── utils/
    ├── domain.js       # Funzioni pure di dominio (score → label, colori)
    ├── dateUtils.js    # Formattazione date it-IT
    ├── reportUtils.js  # Calcoli aggregati per i report PDF
    ├── exportUtils.js  # Logica jsPDF / html2canvas
    └── offlineQueue.js # IndexedDB queue (idb): add, drain, clear
```

---

## 4. Componenti Core

### Sistema RBAC

Tre ruoli con permessi differenziati, embedded nel JWT al login:

| Ruolo | Lettura | Scrittura | Admin |
|---|---|---|---|
| `admin` | Tutti i gruppi | Tutti i gruppi | Sì (DELETE, PATCH protetti) |
| `responsabile_tecnico` | Tutti i gruppi | **Nessuna** | No |
| `allenatore` | Solo i propri `group_ids` | Solo i propri `group_ids` | No |
| `allenatore` + `responsabile_tecnico` | Tutti i gruppi (responsabile prevale sul read) | Solo i propri `group_ids` (allenatore governa il write) | No |

**Flusso utenti:**
- `allenatore`: si auto-registra su `/register` → stato `pending` (nessun accesso ai dati) → admin assegna gruppo → accesso sbloccato.
- `responsabile_tecnico`: creato direttamente dall'admin; nessuna auto-registrazione.
- Il doppio ruolo viene assegnato dall'admin nel pannello utenti.

Lo scoping è applicato tramite `assert_group_access()` e `assert_write_access()` in `rbac.py`. Il lookup degli utenti è O(1) in-memory (nessuna query DB per ogni request). **⚠️ Migrazione imminente su tabella DB — vedi GS-01 in TECHNICAL_ROADMAP.md.**

### Observation Events — Pipeline Cognitiva

Il sottosistema più critico del progetto. Flusso:

```
Coach inserisce evento raw (numerator, denominator, metric_type)
         ↓
POST /sessions/{sid}/events  [ObservationEventsBatchInput]
         ↓
ObservationService.upsert_events():
  1. Valida tutti i player_ids in batch
  2. Delete-per-pair + Insert (idempotente)
  3. SUM(numerator) / SUM(denominator) per (player, metric)
  4. normalized_score() → score 1-10
  5. Write-back su measurements (get-or-create con SAVEPOINT)
  6. Commit
         ↓
Response aggregata: una riga per (player, metric)
```

Le 5 metriche e le loro unità di misura `n`:

| Metrica | Campo DB | `n` = | Min affidabilità |
|---|---|---|---|
| SR (Scanning Rate) | `scanning_rate` | COUNT righe (ricezioni) | 6 |
| DQI (Decision Quality) | `decision_quality` | denominator (n° decisioni) | 20 |
| AI (Anticipation Index) | `anticipation` | numerator (n° successi) | 3 |
| TRS (Transition Reset) | `transition_reset` | denominator (n° transizioni) | 10 |
| VCI (Verbal Comm) | `verbal_comm` | denominator (minuti osservati) | 8 |

### Report Engine

- **Custom hooks** (`useTeamReport`, `usePlayerReport`, etc.) aggregano dati da più endpoint in parallelo (`Promise.all`)
- **Recharts** renderizza i grafici SVG nelle pagine di report
- **exportUtils.js** usa `html2canvas` per catturare il DOM e `jsPDF` per generare il PDF

### Offline Queue

`offlineQueue.js` usa IndexedDB via `idb`. L'interceptor Axios cattura gli errori di rete su POST/PUT/PATCH non-auth e accoda la request. Al ripristino della connessione, le request vengono drenate in ordine FIFO.

---

## 5. Setup & Esecuzione

### Prima configurazione (una tantum)

```bash
# Prerequisiti: python3, node, npm, psql (PostgreSQL 15+)
make setup

# Modifica DATABASE_URL e SECRET_KEY in backend/.env
# Genera la chiave con:
openssl rand -hex 32

# Crea le tabelle
make migrate

# Popola dati iniziali (stagione, gruppi, target)
make seed
```

### Configurazione utenti

Gli utenti sono gestiti in `backend/users.json` (non versionato — copia da `users.example.json`):

```bash
# Genera un hash bcrypt per la password
cd backend && .venv/bin/python scripts/hash_password.py "la-mia-password"
```

Struttura di `users.json`:
```json
{
  "users": [{
    "id": "<uuid>",
    "email": "coach@example.com",
    "hashed_password": "$2b$12$...",
    "roles": ["allenatore"],
    "assigned_group_ids": ["<group-uuid>"],
    "is_active": true
  }]
}
```

### Sviluppo locale

```bash
make dev         # Avvia frontend (porta 5173) + backend (porta 8000) in parallelo
make stop        # Killa i processi su 5173 e 8000
make clean       # Rimuove __pycache__ e .pyc
```

### Sviluppo con Docker Compose (alternativa a `make dev`)

```bash
# Prerequisito: Docker Desktop installato
# Assicurarsi che backend/users.json esista (copiare da users.example.json)
docker compose up --build
```

I servizi partono nell'ordine corretto (`db → backend → frontend`). `alembic upgrade head` viene eseguito automaticamente all'avvio del backend. Il proxy Vite instraderà `/api/*` verso il container backend tramite la variabile `API_TARGET`.

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

### Gestione DB

```bash
make migrate                           # Applica tutte le migrazioni pending
make migration-new MSG="descrizione"   # Crea una nuova migrazione Alembic
make seed                              # Ri-esegue il seed (idempotente)
```

### Variabili d'ambiente (`backend/.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/gestionale
SECRET_KEY=<hex-32-byte>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
APP_ENV=development          # "production" disabilita /docs e /redoc
ALLOWED_ORIGINS=http://localhost:5173
```

### Test e CI

```bash
# Backend (richiede PostgreSQL locale)
cd backend && .venv/bin/pytest tests/ -v

# Frontend
cd frontend && npm test
```

La pipeline CI (`.github/workflows/ci.yml`) esegue automaticamente ruff + pytest (con PostgreSQL 15 reale) + eslint + vitest + build ad ogni push su `main`/`feat/**` e su ogni PR.

### Produzione

Il frontend è una SPA statica (`npm run build → dist/`), servibile con nginx o Cloudflare Pages.  
Il backend va avviato con Uvicorn dietro un reverse proxy:

```bash
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

Impostare `APP_ENV=production` per disabilitare Swagger UI e aggiungere tutte le origini consentite in `ALLOWED_ORIGINS`.
