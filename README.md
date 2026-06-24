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

> **Windows 11:** sostituisci ogni `make <target>` con `.\make.ps1 <target>` (o `make <target>` dal prompt cmd.exe tramite `make.bat`). Vedi [Prerequisiti Windows 11](#prerequisiti-windows-11).

### Avvio e spegnimento quotidiano

```bash
make dev      # avvia tutto: backend + frontend + tunnel remoto + URL/QR per smartphone
```

`make dev` esegue in sequenza: check prerequisiti → check .env → **libera automaticamente le porte** 8000/5173 se occupate → wait database → attiva venv → pip install → `alembic upgrade head` → avvio Uvicorn su `0.0.0.0:8000` → avvio Vite su `5173` → Cloudflare Tunnel (se `cloudflared` è installato).

Al termine mostra tutti gli accessi disponibili:

```
  Backend API  → http://localhost:8000
  Frontend App → http://localhost:5173

  📱 Da smartphone (stessa rete WiFi):
  Frontend     → http://192.168.x.x:5173

  🌐 Da smartphone (qualsiasi rete):
  Tunnel       → https://xxxx.trycloudflare.com
```

**Prerequisiti opzionali** (una volta sola):

```bash
brew install cloudflared   # accesso da rete esterna via tunnel
brew install qrencode      # QR code nel terminale  (oppure: make mobile)
```

Con `cloudflared` installato, `make dev` avvia automaticamente un tunnel pubblico e ne mostra l'URL (e il QR code se `qrencode` è disponibile). L'URL cambia a ogni avvio — nessuna configurazione da modificare.

> **Come funziona il tunnel:** basta un solo tunnel sul frontend (porta 5173). Il browser carica l'app via tunnel e le chiamate `/api` vengono inoltrate dal proxy Vite al backend locale — nessun `VITE_API_URL` da impostare.

> **Porte occupate:** `make dev` non blocca — termina automaticamente il processo che occupa la porta e prosegue. `make stop` resta disponibile per uno shutdown esplicito.

| Situazione | Comando |
|------------|---------|
| Avviare tutto (backend + frontend + tunnel + QR) | `make dev` |
| Come sopra + installa qrencode se mancante | `make mobile` |
| Spegnere tutto (normale) | `Ctrl+C` nel terminale |
| Spegnere tutto (terminale chiuso per errore) | `make stop` |
| Verificare cosa è in esecuzione | `lsof -i :8000 -i :5173` |

### Tutti i comandi

| Comando | Descrizione |
|---------|-------------|
| `make dev` | Avvia frontend + backend + mostra URL per smartphone |
| `make mobile` | Come `make dev` + installa qrencode e mostra QR code |
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

### Prerequisiti Windows 11

**1. Installa i prerequisiti** (una volta sola, da PowerShell):

```powershell
winget install Python.Python.3.13    # o la versione più recente disponibile
winget install OpenJS.NodeJS
winget install PostgreSQL.PostgreSQL.17
```

Se un ID non viene trovato, cerca la versione esatta con `winget search python` o `winget search postgresql`.

Dopo l'installazione di PostgreSQL **riapri il terminale** (il PATH si aggiorna solo alla riapertura). Verifica:

```powershell
psql --version
```

Se `psql` non viene trovato anche dopo la riapertura, aggiungilo manualmente al PATH:

```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\17\bin"
[System.Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Program Files\PostgreSQL\17\bin", "User")
```

**Solo per database locale:** avvia il servizio PostgreSQL e crea il database:

```cmd
net start postgresql-x64-17
psql -U postgres -c "CREATE DATABASE cognitive_tracking;"
```

> Se usi un database remoto (Supabase, Neon, ecc.) questo passaggio non serve — basta avere `psql` installato come client.

**2. Abilita gli script PowerShell** (una volta sola):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

> Se compare un avviso che la policy corrente è già "Bypass", va bene — è ancora più permissiva e gli script funzioneranno ugualmente.

**3. Setup iniziale:**

```powershell
.\make.ps1 setup
```

Crea il file `.env` con il comando `copy` (non usare Notepad o PowerShell `Out-File` che aggiungono un BOM incompatibile con python-dotenv):

```powershell
copy backend\.env.example backend\.env
```

Poi apri `backend\.env` con VS Code e imposta `DATABASE_URL` e `SECRET_KEY`.

**4. Crea `users.json`** (file credenziali, non incluso in git):

```powershell
copy backend\users.example.json backend\users.json
```

Modifica `backend\users.json` con email, nome e hash della password reale. Per generare l'hash bcrypt:

```powershell
backend\.venv\Scripts\python.exe -c "import bcrypt; print(bcrypt.hashpw('TUAPASSWORD'.encode(), bcrypt.gensalt()).decode())"
```

**5. Workflow quotidiano:**

```powershell
.\make.ps1 dev        # avvia tutto (backend + frontend + tunnel se cloudflared è installato)
.\make.ps1 stop       # ferma backend e frontend (porte 8000 e 5173)
.\make.ps1 migrate    # applica nuove migrazioni DB
.\make.ps1 seed       # popola dati iniziali
```

> **Da cmd.exe:** il file `make.bat` rilancia lo script PowerShell automaticamente — puoi usare `make dev`, `make stop`, ecc. dal prompt tradizionale.

> **Terminale chiuso senza Ctrl+C:** lancia `.\make.ps1 stop` in un nuovo terminale per liberare le porte.

**Tool opzionali:**

```powershell
winget install Cloudflare.cloudflared   # tunnel pubblico per accesso da rete esterna
```

Con `cloudflared` installato, `.\make.ps1 dev` avvia automaticamente il tunnel e mostra l'URL pubblico. Per fermarlo quando si chiude il terminale senza Ctrl+C:

```powershell
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
```

> `qrencode` non è disponibile via winget: i QR code nel terminale sono omessi su Windows, ma l'URL del tunnel viene comunque mostrato in chiaro.

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
| Auth | JWT (python-jose) · bcrypt · HttpOnly cookie |
| Export | jsPDF · html2canvas · PapaParse |
| Test | pytest · FastAPI TestClient · SQLite (test DB) |

---

## Autenticazione e Controllo Accessi (RBAC)

L'app usa un sistema di autorizzazione **basato su ruoli (RBAC)** senza tabella utenti nel database. Gli utenti sono definiti in un file locale `backend/users.json` (escluso da git) con password hashate in bcrypt. I ruoli e i gruppi assegnati vengono embeddati nel JWT al momento del login, rendendo ogni richiesta autenticata **O(1)** senza query aggiuntive.

### Ruoli

| Ruolo | CRUD globale | Lettura globale | Scrittura sessioni/misurazioni | Gruppi visibili |
|---|:---:|:---:|:---:|---|
| `admin` | ✓ | ✓ | ✓ | Tutti |
| `responsabile_tecnico` | | ✓ | | Tutti (sola lettura) |
| `allenatore` | | | ✓ | Solo `assigned_group_ids` |

I ruoli sono **cumulativi**: un utente può avere `["responsabile_tecnico", "allenatore"]` per combinare lettura globale e scrittura sui propri gruppi.

### Data scoping

Gli allenatori vedono automaticamente solo i gruppi in `assigned_group_ids`. Il filtraggio avviene a livello di query DB tramite `current_user.read_scope()` (restituisce `None` per chi vede tutto, `set[UUID]` per chi è scoped).

### Guards FastAPI

```python
Depends(require_admin)       # solo admin
Depends(require_staff)       # admin + responsabile_tecnico
Depends(require_auth)        # qualsiasi utente autenticato
assert_group_access(user, group_id)   # 403 se fuori scope lettura
assert_write_access(user, group_id)   # 403 se fuori scope scrittura
```

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
│   │   ├── rbac.py              # Guards FastAPI: require_admin/staff/auth + assert_*_access
│   │   ├── user_store.py        # Carica users.json a startup, dict in-memory per email
│   │   ├── models/
│   │   │   ├── base.py          # DeclarativeBase
│   │   │   ├── user.py          # Utenti admin
│   │   │   ├── season.py        # Stagione sportiva
│   │   │   ├── group.py         # Gruppo/squadra per stagione
│   │   │   ├── player.py        # Anagrafica giocatori
│   │   │   ├── assignment.py    # Assegnazione giocatore → gruppo (storico)
│   │   │   ├── training_session.py  # Sessione di allenamento
│   │   │   ├── measurement.py       # Misurazioni cognitive (voto 1–10 o derivato)
│   │   │   ├── observation_event.py # eventi grezzi (num/denom per metrica, append-only)
│   │   │   ├── group_change_log.py  # Audit log spostamenti giocatori
│   │   │   └── group_target.py      # Target cognitivi per gruppo/parametro
│   │   ├── routers/
│   │   │   ├── auth.py          # /api/auth/* (login, logout, me)
│   │   │   ├── seasons.py       # /api/seasons/* (lista, corrente, crea, archivia)
│   │   │   ├── groups.py        # /api/groups/* (lista, dettaglio, target, history)
│   │   │   ├── players.py       # /api/players/* (CRUD, assign, history)
│   │   │   └── sessions.py      # /api/sessions/* (CRUD, measurements, events)
│   │   ├── schemas/             # Schemi Pydantic per request/response (+ pagination.py)
│   │   └── services/
│   │       ├── auth_service.py        # hash/verify password, JWT, get_current_user
│   │       ├── group_service.py       # query gruppi con eager loading
│   │       ├── observation_service.py # derivazione score + reliability da eventi
│   │       ├── player_service.py      # logica di business per giocatori e assignment
│   │       ├── season_service.py      # logica di business per stagioni
│   │       └── session_service.py     # averages, rankings, upsert measurements
│   ├── alembic/
│   │   └── versions/            # 15 migrazioni (0001 → 0015)
│   │       ├── 0001_initial_schema.py
│   │       ├── 0002–0006_performance_indexes_softdelete_position_events.py
│   │       ├── 0007_observation_events_per_row.py
│   │       ├── 0008_widen_measurement_score_precision.py
│   │       ├── 0009_add_group_change_logs.py
│   │       ├── 0010_db_integrity_fixes.py
│   │       ├── 0011–0013_enable_rls_deny_all.py
│   │       ├── 0014_index_groups_season_id.py
│   │       └── 0015_missing_performance_indexes.py
│   ├── users.example.json       # Template per users.json (committato; users.json è gitignored)
│   ├── scripts/
│   │   └── hash_password.py     # Genera hash bcrypt da inserire in users.json
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
        │   ├── useTeamReport.js / usePlayerReport.js  # Data fetching per report
        │   ├── useSessionTeamReport.js / useSessionPlayerReport.js
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

### Configurazione utenti (users.json)

Gli utenti **non** sono salvati nel database: vengono letti da `backend/users.json` a startup. Questo file è in `.gitignore` e non deve mai essere committato.

**Passo 1 — Genera gli hash bcrypt** per ogni password:

```bash
cd backend
python scripts/hash_password.py MyPassword123!
# Output: $2b$12$xxxx...   ← copia nel campo hashed_password
```

**Passo 2 — Crea `backend/users.json`** partendo dal template `users.example.json`:

```json
{
  "users": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "email": "admin@club.example.com",
      "full_name": "Admin",
      "hashed_password": "$2b$12$...",
      "is_active": true,
      "roles": ["admin"],
      "assigned_group_ids": []
    },
    {
      "id": "00000000-0000-0000-0000-000000000002",
      "email": "coach@club.example.com",
      "full_name": "Allenatore Under 15",
      "hashed_password": "$2b$12$...",
      "is_active": true,
      "roles": ["allenatore"],
      "assigned_group_ids": ["<UUID-del-gruppo>"]
    }
  ]
}
```

> **Note:** gli UUID degli utenti possono essere qualsiasi UUID v4 valido (es. generato con `python -c "import uuid; print(uuid.uuid4())"`). Il campo `assigned_group_ids` è obbligatorio solo per il ruolo `allenatore`; admin e responsabile_tecnico lo lasciano come array vuoto. Verificare che `users.json` sia elencato nel `.gitignore` prima di procedere.

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
| `NTFY_TOPIC` | Topic ntfy.sh per notifiche push (opzionale) | `cognitive-luigi-dev` |

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
    → tutti Numeric(3,1), nullable  (valorizzati da voto manuale O derivati da eventi)
  is_absent (bool) · notes · created_at
  [UNIQUE (session_id, player_id)]  ← garantisce upsert idempotente

observation_events                  ← NUOVO — eventi grezzi per la modalità conteggio
  id (UUID PK) · session_id (FK) · player_id (FK) · group_id (FK)
  metric_type (string: SR|DQI|AI|TRS|VCI)
  numerator (int)    ← eventi positivi osservati
  denominator (int)  ← opportunità totali (o minuti, o 1 per AI)
  method (string: live|video|audio)
  observer_notes (text, nullable)
  created_at · updated_at
  [UNIQUE (session_id, player_id, metric_type)]

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
| POST | `/api/auth/login` | Login → imposta cookie `ct_token` (HttpOnly) e ritorna `{ access_token, user }` |
| POST | `/api/auth/logout` | Logout → cancella il cookie `ct_token` |
| GET | `/api/auth/me` | Utente corrente (ruoli inclusi) |

### Seasons

| Metodo | Path | Descrizione | Ruolo minimo |
|---|---|---|---|
| GET | `/api/seasons/current` | Stagione con `is_current = true` | Qualsiasi |
| GET | `/api/seasons` | Lista tutte le stagioni | admin |
| POST | `/api/seasons` | Crea nuova stagione | admin |
| PUT | `/api/seasons/{id}/archive` | Archivia stagione (non è più corrente) | admin |

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
| POST | `/api/sessions/{id}/measurements` | Upsert batch misurazioni (modalità voto 1–10) |
| GET | `/api/sessions/{id}/measurements` | Lista misurazioni della sessione |
| POST | `/api/sessions/{id}/events` | Upsert batch eventi grezzi (modalità conteggio) |
| GET | `/api/sessions/{id}/events` | Lista eventi grezzi con score derivato e reliability flag |

Tutti gli endpoint (escluso `/api/auth/login`) richiedono autenticazione. Il token JWT viene trasmesso automaticamente dal browser tramite il cookie `ct_token` (HttpOnly, Secure, SameSite=None) impostato al login — nessun header `Authorization` da gestire manualmente.

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

`ProtectedRoute` legge lo stato da `AuthContext`. Se non c'è utente autenticato, redirige a `/login`. Il token JWT è conservato in un cookie **HttpOnly** impostato dal server al login — non è accessibile a JavaScript e non viene mai scritto in `localStorage`.

### Interceptor Axios

`frontend/src/api/axios.js` configura Axios con `withCredentials: true` in modo che il browser alleghi automaticamente il cookie `ct_token` a ogni request. In caso di risposta 401, redirige al login (con flag anti-loop per evitare redirect multipli). In modalità offline, i POST/PUT vengono accodati invece di fallire (vedi sezione PWA).

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

- `test_auth_setup.py` — guards RBAC (require_admin/staff/auth), endpoint `/auth/setup` rimosso, data scoping per allenatore
- `test_auth_login.py` — login valido, password errata, email inesistente, token `/me`
- `test_groups.py` — lista gruppi, dettaglio, target e history
- `test_players.py` — CRUD giocatori, assegnazione gruppi, soft delete
- `test_seasons.py` — creazione stagioni, archiviazione, stagione corrente
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

`make dev` rileva automaticamente l'IP locale e lo mostra nel summary — aprire quell'URL sullo smartphone. Backend su `0.0.0.0:8000`, frontend su `:5173`.

### Accesso remoto (Cloudflare Tunnel)

`make dev` avvia il tunnel automaticamente se `cloudflared` è installato:

```bash
brew install cloudflared   # una volta sola
make dev                   # il tunnel parte insieme al resto
```

L'URL pubblico viene mostrato nel summary (es. `https://xxxx.trycloudflare.com`) — aprirlo sullo smartphone. Basta un solo tunnel sul frontend: le chiamate API vengono inoltrate dal proxy Vite al backend locale, senza bisogno di `VITE_API_URL` o configurazioni aggiuntive. L'URL cambia a ogni avvio.

**Notifica push automatica (opzionale):** installa l'app [ntfy](https://ntfy.sh) sul telefono, iscriviti a un topic a tua scelta e imposta `NTFY_TOPIC=<topic>` nel `.env`. Non appena il tunnel è pronto, ricevi una notifica push con il link direttamente sul telefono — senza bisogno di guardare il terminale.

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

### 2026-06-24 — Security, performance e fix UX

- **RLS PostgreSQL**: Row-Level Security abilitata su tutte le tabelle public con policy deny-all esplicite (migrazioni 0011–0013). Preparazione per accesso diretto PostgREST/Supabase.
- **Index performance**: aggiunti index mancanti su `groups.season_id`, `training_sessions.is_active`, `observation_events.session_id` e composito `(session_id, player_id, metric_type)` (migrazioni 0014–0015).
- **Pagination**: limite massimo ridotto a 200 per list endpoint (`/players`, `/sessions`, `/rankings`) e 500 per `/players/{id}/history`.
- **Status codes**: `ValueError("Giocatori non trovati")` restituisce 422 (invece di 404) in POST `/measurements` e POST `/events` — semanticamente corretto.
- **Assign validation**: `assign_to_group()` valida l'esistenza del gruppo prima dell'insert; `group_id` inesistente → 404 invece di 409 IntegrityError generico.
- **Audit login**: login falliti e riusciti loggati con `request_id` per correlazione e rilevamento brute-force.
- **Frontend dirty tracking**: `SessionDetailPage` aggiunge `useBlocker` (dialog conferma navigazione in-app) e `beforeunload` per evitare perdita dati non salvati.
- **OfflineContext**: imposta `syncError` quando gli item raggiungono max retry — `OfflineBanner` mostra l'errore invece di eliminare dati silenziosamente.

### 2026-06-20 — Notifica push automatica URL tunnel (ntfy.sh)

- `make dev` invia ora una notifica push al telefono non appena il tunnel Cloudflare è pronto, tramite [ntfy.sh](https://ntfy.sh) — nessun account richiesto.
- Funziona sia su macOS (`dev.sh`) sia su Windows (`dev.ps1`): `curl` su bash, `Invoke-WebRequest` su PowerShell.
- Configurazione: `NTFY_TOPIC=<topic>` in `backend/.env`. Se la variabile è assente, il comportamento è identico a prima — nessun errore.
- Aggiunto `ntfy_topic` come campo opzionale in `backend/app/config.py` (Settings Pydantic) per evitare `extra_forbidden` al caricamento.

### 2026-06-19 — Modalità Conteggio Eventi (Event-Based Entry)

Aggiunto un secondo modo di inserimento dati basato su conteggi osservabili, in alternativa al voto olistico 1–10.

- **Nuovo modello `ObservationEvent`** — tabella `observation_events` che memorizza `numerator` / `denominator` per ciascuna metrica per sessione/giocatore. Constraint `UNIQUE(session_id, player_id, metric_type)` garantisce upsert idempotente.
- **`ObservationService`** — logica di derivazione del punteggio 1–10 da conteggi grezzi, con formule specifiche per metrica (rate percentuale per SR/DQI/TRS, conteggio assoluto per AI, frequenza per VCI) e calcolo del `reliability_flag` (insufficient/low/medium/high) in funzione del campione.
- **Due nuovi endpoint** — `POST /api/sessions/{id}/events` (upsert batch eventi + write-back derivato in `measurements`) e `GET /api/sessions/{id}/events` (lista eventi con score e reliability).
- **Frontend — toggle modalità** — `SessionDetailPage` ora espone un toggle "Voto 1–10 / Conteggio eventi". In modalità evento ogni metrica mostra contatori +/− per numeratore e denominatore, con preview del punteggio derivato e badge di affidabilità in tempo reale. Il page si auto-commuta in modalità eventi se la sessione ha già eventi salvati.
- **`METRIC_EVENT_CONFIG` in `domain.js`** — configurazione per label, soglie `min_n` e tipo di raccolta per ciascuna delle 5 metriche. `deriveScore()` e `deriveReliability()` disponibili come utility frontend che replicano esattamente la logica backend.
- **Migrazione `0006_add_observation_events.py`** — aggiunge la tabella con indici su `session_id` e `player_id`.
- **Compatibilità garantita** — la tabella `measurements` e tutti gli endpoint esistenti rimangono invariati; i report leggono sempre `measurements` indipendentemente dalla modalità di inserimento usata.

### 2026-06-17 — RBAC, Sicurezza Auth & Stagioni
- Sistema RBAC file-based: ruoli `admin`, `responsabile_tecnico`, `allenatore` con data scoping a livello query DB.
- JWT ora memorizzato in cookie **HttpOnly/Secure** (eliminato da `localStorage`) per prevenire attacchi XSS.
- Nuovi endpoint `/api/seasons/*` e pagina admin per la gestione delle stagioni.
- Tutti gli endpoint di lista wrappati in envelope paginato `{ items, total }`.
- Vincolo data sessione: la data è limitata all'intervallo della stagione corrente.
- Constraint CORS: metodi e header ora esplicitamente dichiarati.

### 2026-06-17 — Service Layer & Middleware
- Estratta logica di business da `routers/` in `services/player_service.py`, `services/session_service.py` e `services/season_service.py`.
- Aggiunti handler globali FastAPI: `IntegrityError` → 409, eccezioni non gestite → 500.
- Aggiunto `GZipMiddleware` e rate limiting via `slowapi`.
- Nuova migrazione `0003_add_missing_indexes.py` e suite di test per groups, players e sessions.

### 2026-06-15 — PWA & Offline Support
- Implementazione completa PWA: manifest, icone, Service Worker Workbox.
- Coda offline su IndexedDB per misurazioni POST/PUT senza connessione.
- Sincronizzazione automatica al ripristino rete con retry ogni 60 s.
- `OfflineBanner` per feedback visivo dello stato di connessione.

### 2026-06-20 — Accesso da smartphone e tunnel remoto integrati in `make dev`
- `make dev` avvia automaticamente un Cloudflare Tunnel (se `cloudflared` è installato) e ne mostra l'URL nel summary — accesso da qualsiasi rete senza comandi separati.
- Un solo tunnel basta: il proxy Vite inoltra `/api` al backend locale, nessun `VITE_API_URL` da impostare.
- `make dev` rileva anche l'IP locale (en0/en1/fallback) per accesso su rete WiFi.
- `make mobile` installa `qrencode` (brew, una volta sola) e stampa QR code per entrambi gli URL (WiFi e tunnel).

### 2026-06-15 — Automazione avvio sviluppo
- Aggiunto `Makefile` e `scripts/dev.sh` con check prerequisiti, wait-for-DB e log colorati.
- `make dev` libera automaticamente le porte 8000/5173 se occupate (non richiede più `make stop` preventivo).
- Uvicorn avviato su `0.0.0.0` per accesso da device in rete locale.
