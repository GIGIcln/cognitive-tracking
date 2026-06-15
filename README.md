# Cognitive Tracking — Documentazione Tecnica

## Panoramica

Cognitive Tracking è una piattaforma full-stack per il monitoraggio cognitivo di giocatori di calcio giovanile. Permette agli staff tecnici di registrare, tracciare e analizzare cinque parametri cognitivi per ciascun giocatore durante le sessioni di allenamento, confrontandoli con target personalizzati per fascia d'età e livello.

---

## Stack tecnologico

| Layer | Tecnologie |
|---|---|
| Frontend | React 18 · Vite 5 · Tailwind CSS 3 · Recharts 2 · React Router 6 |
| Backend | FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 |
| Database | PostgreSQL 15+ |
| Auth | JWT (python-jose) · bcrypt |
| Export | jsPDF · html2canvas · PapaParse |
| Test | pytest · FastAPI TestClient · SQLite (test DB) |

---

## Architettura del progetto

```
cognitivetracking/
├── backend/
│   ├── app/
│   │   ├── config.py            # Settings via pydantic-settings + .env
│   │   ├── database.py          # Engine SQLAlchemy + SessionLocal + get_db
│   │   ├── main.py              # Entry point FastAPI, CORS, router include
│   │   ├── models/
│   │   │   ├── base.py          # DeclarativeBase
│   │   │   ├── user.py          # Utenti admin
│   │   │   ├── season.py        # Stagione sportiva
│   │   │   ├── group.py         # Gruppo/squadra per stagione
│   │   │   ├── player.py        # Anagrafica giocatori
│   │   │   ├── assignment.py    # Assegnazione giocatore → gruppo (storico)
│   │   │   ├── training_session.py  # Sessione di allenamento
│   │   │   ├── measurement.py   # Misurazioni cognitive per sessione/giocatore
│   │   │   └── group_target.py  # Target cognitivi per gruppo/parametro
│   │   ├── routers/
│   │   │   ├── auth.py          # /api/auth/* (setup, login, me)
│   │   │   ├── groups.py        # /api/groups/* (lista, dettaglio, target, history)
│   │   │   ├── players.py       # /api/players/* (CRUD, assign, history)
│   │   │   └── sessions.py      # /api/sessions/* (CRUD, measurements upsert)
│   │   ├── schemas/             # Schemi Pydantic per request/response
│   │   └── services/
│   │       └── auth_service.py  # hash/verify password, JWT, get_current_user
│   ├── alembic/
│   │   └── versions/
│   │       ├── 0001_initial_schema.py   # Tutte le tabelle base
│   │       └── 0002_add_performance_indexes.py
│   ├── seed.py                  # Seed idempotente: stagione + gruppi + target
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    └── src/
        ├── api/                 # Client Axios per ogni dominio (auth, groups, players, sessions)
        ├── components/          # PlayerFormModal, ProtectedRoute
        ├── constants/domain.js  # COGNITIVE_PARAMS, SESSION_TYPES, LEVEL_COLORS
        ├── context/AuthContext.jsx  # Auth state globale + login/logout
        ├── layouts/MainLayout.jsx   # Sidebar desktop + bottom nav mobile
        ├── pages/               # Una pagina per route
        └── utils/               # dateUtils, exportUtils (PDF + CSV)
```

---

## Setup e avvio

### Prerequisiti

- Python ≥ 3.11
- Node.js ≥ 20
- PostgreSQL ≥ 15

### 1 — Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Modifica .env con DATABASE_URL e SECRET_KEY

alembic upgrade head             # Crea tutte le tabelle

python seed.py                   # Popola stagione, gruppi e target (idempotente)

uvicorn app.main:app --reload --port 8000
```

API interattiva disponibile su `http://localhost:8000/docs`

> **Primo accesso:** visitare `POST /api/auth/setup` per creare il primo utente admin. L'endpoint si disabilita automaticamente dopo la prima chiamata andata a buon fine.

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

App disponibile su `http://localhost:5173`

Il proxy Vite redirige `/api/*` → `http://localhost:8000` (vedi `vite.config.js`).

---

## Variabili d'ambiente

File: `backend/.env` (partire da `.env.example`)

| Variabile | Descrizione | Esempio |
|---|---|---|
| `DATABASE_URL` | Stringa di connessione PostgreSQL | `postgresql://user:pass@localhost:5432/cognitive_tracking` |
| `SECRET_KEY` | Chiave segreta per firma JWT | Output di `openssl rand -hex 32` |
| `ALGORITHM` | Algoritmo JWT | `HS256` (default) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durata token | `60` (default) |
| `APP_ENV` | Ambiente | `development` / `production` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:5173` |

---

## Database — Schema

### Tabelle principali

```
users
  id (UUID PK) · email (unique) · hashed_password · full_name · is_active · created_at

seasons
  id (UUID PK) · name · start_date · end_date · is_current · created_at

groups
  id (UUID PK) · season_id (FK) · name · category · birth_year · level
  sub_group (char 1) · max_players · created_at

players
  id (UUID PK) · first_name · last_name · birth_year · is_active · notes · created_at

player_group_assignments
  id (UUID PK) · player_id (FK) · group_id (FK) · start_date · end_date
  is_current · created_at
  [UNIQUE non esiste — un giocatore può avere più assignment, ma uno solo is_current=true]

training_sessions
  id (UUID PK) · group_id (FK) · season_id (FK) · session_date · session_type
  duration_min · notes · created_at

measurements
  id (UUID PK) · session_id (FK) · player_id (FK) · group_id (FK)
  scanning_rate · decision_quality · anticipation · transition_reset · verbal_comm
    → tutti Numeric(3,1), nullable
  is_absent (bool) · notes · created_at
  [UNIQUE (session_id, player_id)]  ← garantisce upsert idempotente

group_targets
  id (UUID PK) · group_id (FK) · parameter (string) · insufficient_max · ottimo_min
  updated_at
  [UNIQUE (group_id, parameter)]
```

### Logica di upsert per le misurazioni

Il router `POST /api/sessions/{id}/measurements` usa `INSERT ... ON CONFLICT DO UPDATE` (PostgreSQL native) sulla constraint `uq_measurement_session_player`. Questo permette di salvare parzialmente e ricaricare senza duplicati.

### Soft delete

I giocatori non vengono cancellati fisicamente: il campo `is_active` viene portato a `false`. Lo storico delle misurazioni rimane intatto.

---

## API — Endpoints principali

### Auth

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/api/auth/setup` | Crea primo admin (una sola volta) |
| POST | `/api/auth/login` | Login → `{ access_token, token_type, user }` |
| GET | `/api/auth/me` | Utente corrente (richiede Bearer token) |

### Groups

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/groups` | Lista gruppi della stagione corrente |
| GET | `/api/groups/{id}` | Dettaglio gruppo con giocatori e target |
| GET | `/api/groups/{id}/history` | Medie per sessione (per grafici) |
| GET | `/api/groups/{id}/targets` | Target cognitivi del gruppo |
| PUT | `/api/groups/{id}/targets` | Aggiorna/crea target (upsert per parametro) |

### Players

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/players` | Lista giocatori (opzionale: `?group_id=`) |
| POST | `/api/players` | Crea giocatore (opzionale: assegna a gruppo) |
| PUT | `/api/players/{id}` | Aggiorna anagrafica |
| DELETE | `/api/players/{id}` | Soft delete (is_active = false) |
| POST | `/api/players/{id}/assign` | Sposta giocatore in nuovo gruppo |
| GET | `/api/players/{id}/history` | Storico misurazioni del giocatore |

### Sessions

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/sessions` | Lista sessioni (opzionale: `?group_id=`) |
| POST | `/api/sessions` | Crea nuova sessione |
| GET | `/api/sessions/{id}` | Dettaglio sessione con misurazioni |
| GET | `/api/sessions/{id}/averages` | Medie di gruppo per quella sessione |
| POST | `/api/sessions/{id}/measurements` | Upsert batch misurazioni |
| GET | `/api/sessions/{id}/measurements` | Lista misurazioni della sessione |

Tutti gli endpoint (escluso `/api/auth/setup` e `/api/auth/login`) richiedono il token JWT nell'header:
```
Authorization: Bearer <access_token>
```

---

## Frontend — Routing

```
/login                    → LoginPage (pubblica)
/                         → DashboardPage (protetta)
/groups                   → GroupsPage
/groups/:id               → GroupDetailPage (tab: giocatori / target)
/players                  → PlayersPage
/sessions                 → SessionsPage
/sessions/:id             → SessionDetailPage (inserimento misurazioni)
/reports                  → ReportsPage (selezione report)
/reports/player/:playerId → PlayerReportPage
/reports/group/:groupId   → TeamReportPage
```

### Protezione route

`ProtectedRoute` legge lo stato da `AuthContext`. Se non c'è utente autenticato, redirige a `/login`. Il token JWT è salvato in `localStorage` con chiave `ct_token`.

### Interceptor Axios

`frontend/src/api/axios.js` aggiunge automaticamente il Bearer token a ogni request e, in caso di risposta 401, rimuove il token e redirige al login (con flag anti-loop per evitare redirect multipli).

---

## Logica di business — Note chiave

### Stagione corrente

I gruppi e le sessioni sono sempre filtrati per la stagione con `is_current = true`. Il seed imposta automaticamente `is_current = true` sulla stagione creata.

### Assegnazione giocatori ai gruppi

Un giocatore può appartenere a un solo gruppo alla volta (`is_current = true`). Quando viene spostato, l'assignment precedente riceve `end_date = today` e `is_current = false`, e viene creato un nuovo assignment. Lo storico delle misurazioni mantiene il `group_id` della sessione originale.

### Target per gruppo

I target sono definiti per coppia `(group_id, parameter)`. Ogni gruppo ha cinque parametri (SR, DQI, AI, TRS, VCI), ognuno con:
- `insufficient_max`: soglia massima per classificare il valore come "insufficiente"
- `ottimo_min`: soglia minima per classificare il valore come "ottimo"
- Il range intermedio è classificato come "in crescita" / "sufficiente"

### Calcolo medie

Le medie di gruppo per sessione escludono i giocatori con `is_absent = true`. Vengono calcolate server-side tramite `func.avg()` di SQLAlchemy con `outerjoin` su `measurements`.

---

## Test

```bash
cd backend
pip install pytest httpx --break-system-packages

pytest tests/ -v
```

Il file `tests/conftest.py` crea un database SQLite in-memory per i test, sovrascrive la dipendenza `get_db` e ripulisce tutto dopo ogni test. I test coprono:

- `test_auth_setup.py` — primo setup, secondo setup bloccato, race condition, password debole
- `test_auth_login.py` — login valido, password errata, email inesistente, token `/me`

---

## Esportazione dati

### PDF

`exportReportPDF()` in `exportUtils.js` usa `html2canvas` per catturare ogni sezione `.report-section` e le assembla in un documento A4 con `jsPDF`. I pulsanti di esport vengono nascosti durante la cattura e ripristinati al termine.

### CSV

- `exportPlayerCSV()` — storico sessioni del giocatore con valori e target affiancati
- `exportTeamCSV()` — tre sezioni: storico medie squadra, classifica giocatori, target

Entrambi usano BOM UTF-8 (`\uFEFF`) per compatibilità con Excel italiano.

---

## Migrazioni

```bash
# Applicare tutte le migrazioni
alembic upgrade head

# Creare una nuova migrazione (autogenerate dal modello)
alembic revision --autogenerate -m "descrizione"

# Rollback di un passo
alembic downgrade -1
```

L'URL del database viene letto da `os.environ["DATABASE_URL"]` in `alembic/env.py`, non da `alembic.ini`.

---

## Deployment — Note

- In produzione impostare `APP_ENV=production` e aggiornare `ALLOWED_ORIGINS` con il dominio reale.
- Generare `SECRET_KEY` con `openssl rand -hex 32`.
- Il build frontend (`npm run build`) produce una cartella `dist/` da servire come static files (es. via Nginx o integrazione FastAPI `StaticFiles`).
- Il proxy Vite è solo per sviluppo; in produzione configurare Nginx per proxy-passare `/api` all'istanza uvicorn.