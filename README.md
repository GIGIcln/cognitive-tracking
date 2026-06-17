# Cognitive Tracking — Documentazione Tecnica

## ⚡ Avvio Rapido

### Prima volta (setup iniziale)

```bash
make setup      # crea venv, installa dipendenze, copia .env.example → .env
# → modifica backend/.env con DATABASE_URL e SECRET_KEY
make migrate    # crea le tabelle
make seed       # popola stagione, gruppi e target
make dev        # avvia tutto
```

### Avvio e spegnimento quotidiano

```bash
make dev      # avvia tutto (backend + frontend)
```

`make dev` esegue in sequenza: check prerequisiti → check .env → **libera automaticamente le porte** 8000/5173 se occupate → wait database → attiva venv → pip install → `alembic upgrade head` →
avvio Uvicorn su `0.0.0.0:8000` → avvio Vite su `5173`.

> **Porte occupate:** `make dev` non blocca più — termina automaticamente il processo che occupa la porta e prosegue. `make stop` resta disponibile per uno shutdown esplicito.

| Situazione | Comando |
|------------|---------|
| Avviare tutto | `make dev` |
| Spegnere tutto (normale) | `Ctrl+C` nel terminale |
| Spegnere tutto (terminale chiuso per errore) | `make stop` |
| Verificare cosa è in esecuzione | `lsof -i :8000 -i :5173` |

> **Accesso da altri device sulla rete locale:** il backend ascolta su `0.0.0.0`,
> quindi è raggiungibile da qualsiasi device sulla stessa rete WiFi tramite
> `http://<IP-del-mac>:8000`. Il frontend Vite è accessibile su `http://<IP-del-mac>:5173`.

### Tutti i comandi

| Comando | Descrizione |
|---------|-------------|
| `make dev` | Avvia frontend + backend |
| `make stop` | Forza stop se i processi sono rimasti attivi |
| `make setup` | Prima configurazione |
| `make migrate` | Applica migrazioni DB |
| `make seed` | Popola dati iniziali |
| `make migration-new MSG="..."` | Crea nuova migrazione Alembic |
| `make clean` | Rimuove cache Python |
| `make clean-all` | Rimuove anche venv e node_modules |
| `make help` | Mostra tutti i comandi |

### Prerequisiti macOS

```bash
brew install python node postgresql@15
brew services start postgresql@15
createdb cognitive_tracking   # solo prima volta
```

---

## Panoramica

Cognitive Tracking è una piattaforma full-stack per il monitoraggio cognitivo di giocatori di calcio giovanile. Permette agli staff tecnici di registrare, tracciare e analizzare cinque parametri cognitivi per ciascun giocatore durante le sessioni di allenamento, confrontandoli con target personalizzati per fascia d'età e livello.

L'app è installabile come **PWA** su qualsiasi dispositivo (iOS, Android, desktop) e supporta la **modalità offline**: le misurazioni vengono salvate localmente e sincronizzate automaticamente al ripristino della connessione.

---

## Stack tecnologico

| Layer | Tecnologie |
|---|---|
| Frontend | React 18 · Vite 5 · Tailwind CSS 3 · Recharts 2 · React Router 6 |
| PWA | vite-plugin-pwa · Workbox (NetworkFirst / CacheFirst) · idb |
| Backend | FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · slowapi |
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
│   │   ├── limiter.py           # slowapi Limiter (rate limiting per IP)
│   │   ├── main.py              # Entry point FastAPI, CORS, GZip, handler globali
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
│   │       ├── auth_service.py     # hash/verify password, JWT, get_current_user
│   │       ├── player_service.py   # logica di business per giocatori e assignment
│   │       └── session_service.py  # logica di business per sessioni e misurazioni
│   ├── alembic/
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       ├── 0002_add_performance_indexes.py
│   │       └── 0003_add_missing_indexes.py
│   ├── seed.py                  # Seed idempotente: stagione + gruppi + target
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    └── src/
        ├── api/                 # Client Axios per ogni dominio (auth, groups, players, sessions)
        ├── components/          # PlayerFormModal, OfflineBanner, ProtectedRoute
        ├── constants/domain.js  # COGNITIVE_PARAMS, SESSION_TYPES, LEVEL_COLORS
        ├── context/
        │   ├── AuthContext.jsx      # Auth state globale + login/logout
        │   └── OfflineContext.jsx   # Stato online/offline globale + coda sync
        ├── hooks/
        │   └── useOnlineStatus.js   # Hook per rilevare connettività
        ├── layouts/MainLayout.jsx   # Sidebar desktop + bottom nav mobile
        ├── pages/               # Una pagina per route
        └── utils/               # dateUtils, exportUtils (PDF + CSV), offlineQueue
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

### Backend — `backend/.env` (partire da `.env.example`)

| Variabile | Descrizione | Esempio |
|---|---|---|
| `DATABASE_URL` | Stringa di connessione PostgreSQL | `postgresql://user:pass@localhost:5432/cognitive_tracking` |
| `SECRET_KEY` | Chiave segreta per firma JWT | Output di `openssl rand -hex 32` |
| `ALGORITHM` | Algoritmo JWT | `HS256` (default) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durata token | `60` (default) |
| `APP_ENV` | Ambiente | `development` / `production` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:5173` |

### Frontend — `frontend/.env.local` (partire da `frontend/.env.example`)

| Variabile | Descrizione | Esempio |
|---|---|---|
| `VITE_API_URL` | Base URL del backend | `http://localhost:8000` (dev) · `https://api.example.com` (prod) |

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

`frontend/src/api/axios.js` aggiunge automaticamente il Bearer token a ogni request e, in caso di risposta 401, rimuove il token e redirige al login (con flag anti-loop per evitare redirect multipli). In modalità offline, i POST/PUT vengono accodati invece di fallire (vedi sezione PWA).

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

### Rate Limiting & Error Handling

`slowapi` applica un limite di richieste per IP sugli endpoint di autenticazione per prevenire attacchi brute-force.

Il middleware globale in `main.py` gestisce in modo uniforme:
- `IntegrityError` (PostgreSQL) → **409 Conflict** con messaggio JSON strutturato
- Eccezioni non gestite → **500 Internal Server Error** con log server-side
- **GZipMiddleware** comprime automaticamente le risposte > 1 KB

---

## PWA & Modalità Offline

L'app è una **Progressive Web App** installabile su qualsiasi dispositivo tramite il browser (iOS, Android, Chrome desktop).

### Installazione

Aprire l'app nel browser e usare "Aggiungi alla schermata Home" (iOS/Android) o l'icona di installazione nella barra degli indirizzi (Chrome). Il manifest (`frontend/public/manifest.json`) definisce nome, icone e colori dell'app.

### Offline Queue

Quando il device perde la connessione, l'interceptor Axios intercetta le richieste `POST`/`PUT` verso `/api/sessions` e `/api/measurements` e le salva in **IndexedDB** tramite `offlineQueue.js`. Le richieste verso `/api/auth` non vengono mai accodate.

### Sincronizzazione automatica

`OfflineContext` monitora lo stato della connessione tramite `useOnlineStatus`. Al ripristino della rete:
1. Legge la coda da IndexedDB
2. Invia le richieste in ordine (FIFO)
3. Rimuove ogni voce solo dopo conferma del server
4. Ritenta ogni **60 secondi** in caso di errore parziale

### Banner visivo

`OfflineBanner` mostra un indicatore persistente con quattro stati:
- **Offline** — nessuna connessione, le misurazioni vengono salvate localmente
- **Sincronizzazione in corso** — invio della coda al server
- **In attesa** — coda presente ma sync fallita, prossimo retry tra X secondi
- **Online** — tutto sincronizzato (banner scompare dopo 3 s)

### Caching Workbox

| Risorsa | Strategia |
|---|---|
| Asset statici (JS, CSS, font) | CacheFirst |
| `GET /api/auth/me` | NetworkFirst (mantiene sessione offline) |
| Altre chiamate API | NetworkOnly (dati sempre freschi quando online) |

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
- `test_groups.py` — lista gruppi, dettaglio, target e history
- `test_players.py` — CRUD giocatori, assegnazione gruppi, soft delete
- `test_sessions.py` — creazione sessioni, upsert misurazioni, medie di gruppo

---

## Esportazione dati

### PDF

`exportReportPDF()` in `exportUtils.js` usa `html2canvas` per catturare ogni sezione `.report-section` e le assembla in un documento A4 con `jsPDF`. I pulsanti di export vengono nascosti durante la cattura e ripristinati al termine.

### CSV

- `exportPlayerCSV()` — storico sessioni del giocatore con valori e target affiancati
- `exportTeamCSV()` — tre sezioni: storico medie squadra, classifica giocatori, target

Entrambi usano BOM UTF-8 (`﻿`) per compatibilità con Excel italiano.

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

## Deployment

### Locale / LAN

Impostazione predefinita: backend su `0.0.0.0:8000`, frontend su `:5173`. Accessibile da qualsiasi device sulla stessa rete WiFi.

### Cloud (Render + Vercel + Neon)

| Servizio | Componente |
|---|---|
| [Render](https://render.com) | Backend FastAPI (Web Service) |
| [Vercel](https://vercel.com) | Frontend React (Static) |
| [Neon](https://neon.tech) | PostgreSQL serverless |

Passi chiave:
1. Su Neon: creare un database e copiare la `DATABASE_URL`.
2. Su Render: creare un Web Service dal repo, impostare le variabili d'ambiente (`DATABASE_URL`, `SECRET_KEY`, `ALLOWED_ORIGINS` con il dominio Vercel).
3. Su Vercel: importare il repo, impostare `VITE_API_URL` con l'URL del servizio Render.

### Note generali

- In produzione impostare `APP_ENV=production` e aggiornare `ALLOWED_ORIGINS` con il dominio reale.
- Generare `SECRET_KEY` con `openssl rand -hex 32`.
- Il build frontend (`npm run build`) produce una cartella `dist/` da servire come static files (es. via Nginx o integrazione FastAPI `StaticFiles`).
- Il proxy Vite è solo per sviluppo; in produzione configurare Nginx (o Vercel rewrites) per proxy-passare `/api` all'istanza uvicorn.

---

## Changelog

### 2026-06-17 — Service Layer & Middleware
- Estratta logica di business da `routers/` in `services/player_service.py` e `services/session_service.py`.
- Aggiunti handler globali FastAPI: `IntegrityError` → 409, eccezioni non gestite → 500.
- Aggiunto `GZipMiddleware` e rate limiting via `slowapi`.
- Nuova migrazione `0003_add_missing_indexes.py` e suite di test per groups, players e sessions.

### 2026-06-15 — PWA & Offline Support
- Implementazione completa PWA: manifest, icone, Service Worker Workbox.
- Coda offline su IndexedDB per misurazioni POST/PUT senza connessione.
- Sincronizzazione automatica al ripristino rete con retry ogni 60 s.
- `OfflineBanner` per feedback visivo dello stato di connessione.

### 2026-06-15 — Automazione avvio sviluppo
- Aggiunto `Makefile` e `scripts/dev.sh` con check prerequisiti, wait-for-DB e log colorati.
- `make dev` libera automaticamente le porte 8000/5173 se occupate (non richiede più `make stop` preventivo).
- Uvicorn avviato su `0.0.0.0` per accesso da device in rete locale.
