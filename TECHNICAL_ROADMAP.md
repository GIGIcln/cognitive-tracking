# TECHNICAL_ROADMAP.md — Roadmap Tecnica Gestionale Sportivo

> Basata sull'analisi dello stato attuale del codice (giugno 2026). Aggiorna questa sezione quando una voce viene chiusa o cambia priorità.
>
> Il progetto è in transizione da cognitive tracking a **gestionale sportivo completo**. La sezione **GS-*** (Gestionale Sportivo) raccoglie i nuovi moduli da costruire. Le sezioni TD-*/OL-* riguardano il debito tecnico e refactoring dell'impianto esistente.

---

## 1. Stato Attuale & Punti di Forza

Il progetto è in uno stato strutturalmente solido per le sue dimensioni:

- **Service layer completo**: tutti i router delegano la logica ai service (`session_service.py`, `observation_service.py`, etc.). I router si occupano solo di wiring HTTP.
- **Gestione errori globale**: `main.py` cattura `RequestValidationError`, `OperationalError`, `IntegrityError` e `Exception` non gestite con response JSON strutturate e header `X-Request-ID`.
- **RBAC funzionante**: tre ruoli (`admin`, `responsabile_tecnico`, `allenatore`) con group-level scoping. Zero query DB per request autenticata (lookup O(1) in-memory).
- **Rate limiting attivo**: `@limiter.limit("5/minute")` su login, 60–120/min sugli altri endpoint.
- **RLS PostgreSQL**: Row-Level Security abilitata su tutte le tabelle public con policy deny-all (migrazioni 0011–0013). Preparazione per accesso PostgREST/Supabase.
- **API client centralizzato**: `api/axios.js` con interceptor 401, `withCredentials` e offline queue (IndexedDB) per mutation offline.
- **Test di integrazione backend**: `pytest-postgresql` con database reale (non mock). Copertura su auth, sessions, observation events, players, groups, middleware.
- **PWA**: `vite-plugin-pwa` configurato; offline banner e coda mutation già operativi.
- **Pipeline cognitiva robusta**: observation events append-only, batch idempotente, aggregazione SQL-side prima della derivazione. Definizioni congelate in `codebook-v1.md`.
- **Frontend robusto**: dirty tracking in `SessionDetailPage` (`useBlocker` + `beforeunload`); `OfflineContext` propaga `syncError` a `OfflineBanner`; pagination limits corretti (max 200/500).

---

## 2. Tech Debt (Debito Tecnico Attuale)

### 🔴 Alta Priorità

**[TD-01] Auth file-based non scalabile (`users.json`)** → **sostituito da GS-01**  
Attualmente gli utenti sono in un file JSON caricato in memoria all'avvio. Aggiungere o modificare un utente richiede di editare il file e ricaricare il server. Non c'è UI di gestione, no auto-registrazione, no reset password self-service. **Pre-requisito bloccante per tutti i nuovi moduli del gestionale.**  
_File:_ `backend/app/user_store.py`, `backend/users.json`

**~~[TD-02] SQLAlchemy sincrono in un'app FastAPI asincrona~~** ✅ Risolto  
`create_async_engine` + `AsyncSession` + `async_sessionmaker`. Driver: `asyncpg` (PostgreSQL), `aiosqlite` (test). Tutti gli 11 service e 8 router convertiti in `async def`. Test suite: `pytest-asyncio` (`asyncio_mode=auto`) + `httpx.AsyncClient` + `ASGITransport`. 106 test passati su SQLite; pg_seeded per i test che richiedono ON CONFLICT reale.  
_File:_ `backend/app/database.py`, tutti i `services/`, `routers/`, `tests/`

**~~[TD-03] Nessun sistema di CI/CD~~** ✅ Risolto con OB-01  
`.github/workflows/ci.yml` attivo su ogni push/PR: job `backend` (ruff + pytest + postgres reale) e `frontend` (eslint + vitest + tsc + build). Job `e2e` Playwright con Chromium (OL-05).

**~~[TD-04] Rankings calcolati in Python, non in SQL~~** ✅ Risolto  
Riscritto con aggregazione SQL-side (`func.coalesce`, `cast`, `desc`): il DB calcola la media riga-per-riga sui campi non-NULL e ordina; Python riceve solo la lista già ordinata.  
_File:_ `backend/app/services/session_service.py`

### 🟡 Media Priorità

**~~[TD-05] Frontend senza TypeScript~~** ✅ Risolto con OL-03  
Migrazione TypeScript completa (PR #2, 2026-06-26): tutti i file `*.jsx`/`*.js` convertiti in `*.tsx`/`*.ts`. Tipi centralizzati in `types/api.ts`. `tsc --noEmit` → 0 errori in strict mode.

**~~[TD-06] Gestione stato globale assente (oltre all'auth)~~** ✅ Risolto  
React Query esteso da stagioni/gruppi (OL-04) a sessioni, giocatori e dashboard. `usePlayers()`, `useSessions()`, `useCurrentSeason()` in `hooks/useSeasonData.ts`. `PlayersPage` e `SessionsPage` eliminano fetch manuali; `DashboardPage` usa 4 `useQuery` paralleli con spinner per-sezione. `invalidateQueries` su tutti i CRUD.  
_File:_ `frontend/src/hooks/useSeasonData.ts`, `frontend/src/pages/PlayersPage.tsx`, `frontend/src/pages/SessionsPage.tsx`, `frontend/src/pages/DashboardPage.tsx`

**~~[TD-07] No containerizzazione~~** ✅ Risolto  
`docker-compose.yml` con servizi `db` (postgres:15), `backend` e `frontend`. Hot-reload su entrambi; `alembic upgrade head` eseguito automaticamente all'avvio del backend.

**~~[TD-08] Rate limiting non applicato ai router~~** ✅ Risolto  
`@limiter.limit("5/minute")` applicato su `/auth/login`; `60/minute` su list endpoint players e sessions; `120/minute` su endpoints di scrittura. Brute-force protetto.

**~~[TD-11] Definizioni delle metriche sparse in 5+ sorgenti~~** ✅ Risolto  
`domain.ts` è ora la fonte unica: aggiunte `METRIC_COLORS`, `METRIC_COLORS_BY_TYPE`, `METRIC_LABEL_MAP` derivate da `COGNITIVE_PARAMS`. Rimossi: `METRIC_COLORS` inline da `PlayerDetailPage`, `HISTORY_COLORS` e `METRICS` inline da `GroupDetailPage`, `TEAM_FIELD_KEYS` hardcoded da `SessionTeamReportPage` e `TeamReportPage`, `PLAYER_FIELD_KEYS` hardcoded da `PlayerReportPage`, entrambe le `paramLabels` inline da `exportUtils`. `tsc --noEmit` → 0 errori.  
_File:_ `frontend/src/constants/domain.ts`

**~~[TD-12] Reliability preview SR disallineata tra frontend e backend~~** ✅ Risolto con OL-09  
`deriveSRReliability(n)` aggiunta in `domain.ts`; `useSessionForm.ts` usa `COUNT(righe valide)` come n per SR in tutti e tre i callback di reliability, escludendo SR da `deriveReliability()` (che usava denominator). Soglie 3/6/12 allineate al backend (`min_n=6`, `half=3`, `medium=min_n*2=12`).  
_File:_ `frontend/src/constants/domain.ts`, `frontend/src/hooks/useSessionForm.ts`

**~~[TD-13] `SessionDetailPage` monolite (930+ righe)~~** ✅ Risolto con OL-07  
Ridotta a 516 righe. Vedi OL-07 per il dettaglio dei componenti estratti.

**~~[TD-14] Offline queue senza tetto di retry e cleanup~~** ✅ Risolto  
Il cap di retry era già implementato in `OfflineContext.jsx` (magic number `3`). Fix applicata: estratto `MAX_RETRIES = 5` come costante, aggiunto `MAX_AGE_MS = 7 giorni` per scartare item stantii al prossimo sync. Item 4xx già rimossi immediatamente; `syncError` segnala al banner quando item vengono scartati. 2 nuovi test: expiry + item valido non filtrato.

### 🟢 Bassa Priorità

**~~[TD-09] UI non mostra `reliability_flag` all'utente~~** ✅ Risolto  
Badge per metrica presenti in `EventParamRow` con colore + label da `RELIABILITY_META`. Gate di pubblicazione in `SessionDetailPage` blocca il bottone "Salva" se almeno un giocatore ha reliability `insufficient`.

**~~[TD-10] `codebook_version=None` non gestito nel frontend~~** ✅ Risolto  
`SessionDetailPage` ora rileva versioni miste sia al caricamento (GET events, versioni distinte nel raw array) sia al salvataggio (POST response aggregata, `codebook_version=null`). In entrambi i casi mostra un banner ambra persistente: "Attenzione: dati con versioni diverse del codebook — parametri potrebbero non essere confrontabili."

---

## 3. Obiettivi a Breve Termine (1–3 mesi)

### ~~OB-01 — CI/CD con GitHub Actions~~ ✅ Completato

`.github/workflows/ci.yml` con due job paralleli: `backend` (ruff + pytest con PostgreSQL 15 reale) e `frontend` (eslint + vitest + build). Eseguito ad ogni push su `main`/`feat/**` e su ogni PR.

### ~~OB-02 — Rate Limiting attivo~~ ✅ Completato

`@limiter.limit("5/minute")` su `/auth/login`; 60/minute su list endpoint; 120/minute su mutation. Applicato a `auth.py`, `players.py`, `sessions.py`.

### ~~OB-03 — UI di `reliability_flag`~~ ✅ Completato

Badge per metrica già presenti in `EventParamRow` (colore + label da `RELIABILITY_META`). Gate di pubblicazione aggiunto in `SessionDetailPage`: `hasInsufficientMetric()` + `insufficientGateCount` bloccano il bottone "Salva" se almeno un giocatore ha una metrica con reliability `insufficient`. Warning ambra (⚠) rimane per `low`.

### ~~OB-04 — Rankings in SQL~~ ✅ Completato

`get_rankings()` riscritto con aggregazione SQL-side (`func.coalesce`, `cast`, `desc`). Il DB calcola la media riga-per-riga sui campi non-NULL e ordina; Python riceve solo la lista già ordinata per il ranking denso e il percentile.  
_File:_ `backend/app/services/session_service.py`

### ~~OB-05 — Docker Compose per sviluppo locale~~ ✅ Completato

`docker-compose.yml` con servizi `db` (postgres:15), `backend` e `frontend`. Hot-reload su entrambi; `alembic upgrade head` eseguito automaticamente ad ogni `docker compose up`. Il proxy Vite legge `API_TARGET` per raggiungere il backend nel network interno Docker.

### ~~OB-06 — Allineamento reliability SR nel frontend~~ → riclassificato in OL-09

Analisi approfondita (codebook v1 + observation_service.py + SessionDetailPage) ha rivelato che il disallineamento non è un semplice fix di soglia. Il codebook specifica `una riga = una ricezione, denominator = durata finestra in secondi`, il backend segue questa semantica (`n = COUNT(rows)`, `min_n=6`), ma il frontend usa una riga aggregata con `denominator = ricezioni totali` e `min_n=15`. Con la UI attuale (un solo evento per metrica per player) `COUNT(rows) = 1` dopo ogni save → SR è sempre "insufficient" dal backend. La fix richiede supporto per multiple righe SR nell'UI. Spostato in OL-09.

---

## 4. Obiettivi a Lungo Termine (6+ mesi)

### OL-01 — Migrazione a SQLAlchemy asincrono

Passare da `create_engine` / `sessionmaker` a `create_async_engine` / `AsyncSession`. Richiede:
- Aggiornamento di tutti i service (aggiungere `await` sulle query)
- Driver `asyncpg` al posto di `psycopg2-binary`
- Aggiornamento dei test (pytest-asyncio)

Sblocca: più connessioni concorrenti con meno thread, migliore utilizzo delle risorse.

### OL-02 — Migrazione Auth su PostgreSQL → **sostituito e ampliato da GS-01**

Vedi GS-01 nella sezione Gestionale Sportivo qui sotto.

### ~~OL-03 — Frontend TypeScript~~ ✅ Completato

Migrazione TypeScript completa (PR #2, mergiata 2026-06-26): tutti i file `*.jsx`/`*.js` convertiti in `*.tsx`/`*.ts`. Tipi centralizzati in `types/api.ts`; pattern per `useState`, `useParams`, accesso dinamico su oggetti e Recharts documentati. `tsc --noEmit` → 0 errori in strict mode.  
_File:_ `frontend/src/types/api.ts`, `frontend/src/constants/domain.ts`

### ~~OL-04 — Gestione stato globale con React Query (TanStack Query)~~ ✅ Completato (esteso in TD-06)

React Query v5 già installato e configurato (staleTime 5min, retry 1). I 4 hook report lo usavano già.
Migrazione estesa a stagioni e gruppi (OL-04), poi a sessioni, giocatori e dashboard (TD-06):
- `hooks/useSeasonData.ts`: `useSeasons()`, `useGroups(seasonId?)`, `usePlayers(groupId?)`, `useSessions(groupId?, seasonId?)`, `useCurrentSeason()`
- `SeasonGroupContext` usa i hook invece di fetch manuali — cache condivisa con le pagine
- `GroupsPage`, `SeasonsPage`: `useMutation` (create/update/delete) con `invalidateQueries`
- `PlayersPage`: `usePlayers()` + invalidazione su delete/bulkAssign/modal save
- `SessionsPage`: `useSessions()` + `setQueryData` ottimistico su delete
- `DashboardPage`: 4 `useQuery` paralleli indipendenti (per-card loading state)

_File:_ `frontend/src/hooks/useSeasonData.ts`, `frontend/src/context/SeasonGroupContext.tsx`, `frontend/src/pages/`

### ~~OL-05 — E2E Testing con Playwright~~ ✅ Completato

Suite Playwright in `frontend/e2e/` con 4 spec file, 9 test totali:
- `login.spec.ts` — form render, login valido, credenziali errate
- `session-gate.spec.ts` — gate SR: dati insufficienti bloccano salvataggio, soglia sufficiente sblocca
- `session-events.spec.ts` — DQI medium (score 7.8 + "Affid. media"), DQI bassa (denominator < min_n → "Affid. bassa")
- `session-create.spec.ts` — pulsante "Nuova sessione" visibile per admin, modal con gruppo e submit button

Tutti i test usano `page.route()` per intercettare le API (`/api/*`) senza backend reale.
Job `e2e` aggiunto in `ci.yml`: install Playwright + chromium, `npx playwright test`, upload report on failure.

_File:_ `frontend/e2e/`, `frontend/playwright.config.ts`, `.github/workflows/ci.yml`

### ~~OL-06 — PDF generation server-side (WeasyPrint)~~ ✅ Completato

Migrazione completa da html2canvas/jsPDF a generazione server-side. `exportUtils.ts` espone `exportReportPDF(apiPath, filename)` che chiama il backend e scarica il blob direttamente.

Backend (`app/routers/reports.py`, `app/services/report_service.py`):
- `GET /reports/player/{id}/pdf` — report storico giocatore (sparkline SVG inline)
- `GET /reports/team/{id}/pdf` — report storico squadra (bar chart SVG inline)
- `GET /reports/session/{id}/team/pdf` — report squadra sessione singola
- `GET /reports/session/{id}/player/{player_id}/pdf` — report giocatore sessione singola

Template Jinja2 in `app/templates/` (4 file HTML): color-coding good/mid/bad, tabelle classifica, SVG inline. Rendering WeasyPrint (lazy import).

Frontend fix: `SessionTeamReportPage` e `SessionPlayerReportPage` usavano `'report-content'` (legacy html2canvas) → corretti con i path API corretti.  
_File:_ `backend/app/routers/reports.py`, `backend/app/services/report_service.py`, `backend/app/templates/`

### ~~OL-07 — Refactoring `SessionDetailPage` in componenti e custom hook~~ ✅ Completato

Pagina ridotta da 930+ righe a 516 righe attraverso iterazioni successive:
- `EventParamRow`, `NotesBlock`, `SRMultiRowInput`, `AttendanceTab` → componenti autonomi in `components/`
- `useSessionForm()` → custom hook con tutto lo stato e i side effect (OL-09)
- `DesktopPlayerCard` → card desktop per giocatore con `valueBadgeClass` helper (OL-07)
- `UnsavedChangesDialog` → dialog blocker navigazione (OL-07)
- `SessionChips` → `ReliabilityChip` + `ScoreCompletenessChip` condivisi (OL-07)
- `tsc --noEmit` → 0 errori dopo ogni step

_File:_ `frontend/src/pages/SessionDetailPage.tsx`, `frontend/src/components/`

### ~~OL-09 — Workflow SR multi-riga e allineamento reliability~~ ✅ Completato

- `denominator_label` aggiornato a "Durata finestra (sec)" in `domain.ts`
- UI `SessionDetailPage`: multiple righe SR per giocatore (una per ricezione)
- Live preview reliability SR: `deriveSRReliability(COUNT righe valide)` con soglie 3/6/12 — allineato al backend
- `deriveScore('SR')`: denominator ora in secondi → scansioni/sec

_File:_ `frontend/src/constants/domain.ts`, `frontend/src/pages/SessionDetailPage.jsx`, `frontend/src/hooks/useSessionForm.ts`

### ~~OL-08 — Fonte unica di verità per le definizioni di metrica~~ ✅ Backend completato

- **Frontend** consolidato in TD-11: `domain.js` è l'unico owner; definizioni duplicate rimosse da `PlayerDetailPage`, `GroupDetailPage`, `exportUtils.js`.
- **Backend** ora usa `backend/app/codebook.py` come unica fonte: `METRIC_DEFINITIONS` (lista completa con field, label, min_n, reliability_n_basis, ecc.), `METRIC_MIN_N` e `METRIC_TO_FIELD` derivati. `observation_service.py` importa da qui invece di ridefinire i suoi dict.
- **`GET /api/meta/metrics`** (pubblico) serve `METRIC_DEFINITIONS` completo: consumer esterni e futuri frontend possono sincronizzarsi senza hardcoding locale. 6 test backend coprono l'endpoint e la coerenza dei derived dicts.
- **Passo successivo opzionale:** far sì che `domain.js` carichi `min_n` dall'endpoint al boot (richiede gestione loading state e cache — da valutare con OL-09).

---

## 5. Sicurezza & Performance

### Sicurezza

| Area | Stato attuale | Azione |
|---|---|---|
| **Autenticazione** | JWT HS256, HttpOnly cookie, bcrypt | ✅ Solido. Valutare refresh token per sessioni lunghe |
| **Rate limiting** | Applicato: 5/min login, 60/min list, 120/min mutation | ✅ Attivo |
| **CORS** | Origini esplicite in produzione; regex trycloudflare solo in dev | ✅ Corretto |
| **Upload size** | 1MB hard cap via `_LimitUploadSize` middleware | ✅ Presente |
| **SQL injection** | Parametrizzazione ORM SQLAlchemy | ✅ Protetto per costruzione |
| **RLS PostgreSQL** | Abilitata su tutte le tabelle public, policy deny-all esplicite | ✅ Presente (mig. 0011–0013) |
| **Secrets** | `SECRET_KEY` validata (≥32 byte), `.env` non versionato | ✅ Corretto |
| **OpenAPI** | Disabilitato in `APP_ENV=production` | ✅ Corretto |
| **users.json** | Sostituito da tabella `users` DB-based (GS-01) | ✅ Risolto |
| **Audit log** | Login riusciti/falliti loggati con `request_id`; `GroupChangeLog` per spostamenti | Estendere a audit per-utente con GS-01 |

### Performance

| Area | Stato attuale | Azione |
|---|---|---|
| **Pool DB** | `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True` | ✅ Adeguato per uso attuale |
| **Indici DB** | Migrazioni 0002 e 0003 aggiungono indici performance | ✅ Presenti |
| **Aggregazioni SQL** | `func.avg()` usato in `get_averages()` | ✅ Corretto |
| **Rankings** | `func.coalesce` + `desc` SQL-side in `get_rankings()` | ✅ SQL-side (OB-04) |
| **GZip** | Attivo per response > 1KB | ✅ Presente |
| **Frontend lazy loading** | Pagine pesanti (report, SessionDetail) caricate on-demand | ✅ Presente |
| **PDF export** | Generazione server-side WeasyPrint con Jinja2 (4 endpoint) | ✅ Completato con OL-06 |
| **Offline** | Mutation code in coda IndexedDB | ✅ Operativo |

---

## 6. Gestionale Sportivo — Nuovi Moduli (GS-*)

Sequenza di sviluppo pianificata. Ogni modulo è bloccante per il successivo dove indicato.

### ~~GS-01 — Migrazione Auth su DB + Registrazione Allenatori~~ ✅ Completato

Pre-requisito bloccante per tutti i nuovi moduli. Sostituisce TD-01 e OL-02.

- Tabella `users` DB-based con `id`, `email`, `hashed_password`, `roles[]`, `assigned_group_ids[]`, `is_active`, `status`, `created_at`
- Login 100% DB-based via `UserService`; `users.json` usato solo per seed locale in sviluppo
- `POST /api/auth/register` crea allenatore in stato `pending`
- `GET /auth/me` restituisce utente corrente dal JWT
- `ProtectedRoute` gestisce stato `pending` → `PendingPage`
- Pannello `/impostazioni/utenti` (admin-only): `GET/POST/PATCH/DELETE /api/users`
- Test copertura: `tests/test_users.py`

---

### ~~GS-02 — Pannello Admin Utenti~~ ✅ Completato

Dipende da: GS-01. Implementato insieme a GS-01.

- `UsersAdminPage.jsx` in `/impostazioni/utenti` (solo admin)
- Lista utenti con stato, ruolo, gruppo assegnato
- Attiva/sospende account, cambia ruolo, assegna/rimuove gruppo
- Elimina utente (con guard auto-eliminazione)

---

### ~~GS-03 — Anagrafica Giocatore Estesa~~ ✅ Completato

Campi aggiunti su `Player`: data di nascita, nazionalità, ruolo tattico, piede preferito, numero di maglia, tessera federale, note mediche. Scheda giocatore nel frontend con tab `[Anagrafica]  [Cognitivo]  [Presenze]  [Partite]  [Infortuni]`.

---

### ~~GS-04 — Modulo Presenze~~ ✅ Completato

Tabella `attendance` (session_id, player_id, status: `present|absent|justified|injured`, note) integrata in `SessionDetailPage`. Report presenze con % partecipazione stagionale per giocatore nella sezione Allenamenti.

---

### ~~GS-05 — Modulo Partite~~ ✅ Completato

Tabelle `match` e `match_lineup` (minutaggi, posizioni). Sezione Partite nella nav: calendario gare, risultati, formazioni, report interno.

---

### ~~GS-06 — Impostazioni Gruppo (Allenatore)~~ ✅ Completato

Sezione `/impostazioni` per allenatore con giorni di allenamento, orario, luogo (`group_settings`). Gate modalità punteggio integrato in `SessionDetailPage`.

---

### ~~GS-07 — Infortuni & Disponibilità~~ ✅ Completato

Dipende da: GS-03.

Tabella `injury_log` (player_id, injury_type, start_date, expected_return, actual_return, severity, notes). Vista "stato rosa" nella sezione Rosa con badge disponibilità (disponibile / infortunato / limitato).

---

### ~~GS-08 — UI Redesign: Context Bar + Layout~~ ✅ Completato

- **SeasonGroupContext**: stagione e gruppo attivi persistiti in `localStorage`; auto-selezione del primo disponibile; invalidazione automatica se il valore stored non esiste più. Consumato da `SessionsPage` (filtro gruppo bidirezionale).
- **Layout allargato**: `max-w-4xl` → `max-w-6xl` in `MainLayout`.
- **Sidebar collassabile**: `w-60` ↔ `w-16` icons-only, stato persistito in `localStorage`. Pill di toggle sull'edge destra.
- **Context bar desktop**: selettori Stagione + Gruppo nella sidebar; compact strip sticky su mobile.
- **Bottom nav mobile**: 4 voci primarie + drawer "Altro" per le secondarie.
- **Dashboard role-specific**: non implementata — `DashboardPage` è ancora uniforme per tutti i ruoli. Da valutare come task separato se necessario.

_File:_ `frontend/src/context/SeasonGroupContext.jsx`, `frontend/src/layouts/MainLayout.jsx`, `frontend/src/pages/SessionsPage.jsx`

---

### ~~GS-09 — Statistiche Partita estese + tab Partite in PlayerDetailPage~~ ✅ Completato

- Migrazione 0021: `goals`, `assists`, `yellow_cards`, `red_cards`, `rating` (Numeric 3,1) su `match_lineups`
- `MatchDetailPage`: griglia formazione espansa con gol, assist, cartellini, voto (step 0.5)
- Endpoint `GET /players/{id}/matches` con storico gare e stats per giocatore
- Tab **Partite** in `PlayerDetailPage`: sommario stagionale (partite/minuti/gol/assist/voto medio) + lista gare con risultato V/S/P

_File:_ `backend/alembic/versions/0021_*`, `backend/app/models/match.py`, `backend/app/schemas/match.py`, `backend/app/services/match_service.py`, `backend/app/routers/players.py`, `frontend/src/pages/MatchDetailPage.tsx`, `frontend/src/pages/PlayerDetailPage.tsx`

---

### ~~GS-10 — Dashboard role-specific~~ ✅ Completato

- **Admin**: banner utenti in attesa di attivazione (status `pending`) con link a `/impostazioni/utenti`
- **Responsabile tecnico**: sezione "Squadre" con card per ogni gruppo (nome, livello, categoria, anno)
- **Allenatore**: sezione "Disponibilità rosa" con lista giocatori del proprio gruppo e badge disponibilità

_File:_ `frontend/src/pages/DashboardPage.tsx`

---

### ~~GS-11 — Convocazioni pre-gara~~ ✅ Completato

- Migrazione 0022: tabella `match_convocations` (match_id, player_id, unique constraint)
- Endpoint `GET/PUT /matches/{id}/convocations` per salvataggio batch
- Tab **Convocati** in `MatchDetailPage`: toggle per giocatore (ordinati: convocati prima), flag disponibilità, badge count nel tab header

_File:_ `backend/alembic/versions/0022_*`, `backend/app/models/match.py`, `backend/app/schemas/match.py`, `backend/app/services/match_service.py`, `backend/app/routers/matches.py`, `frontend/src/pages/MatchDetailPage.tsx`

---

### ~~GS-12 — Tab Presenze in PlayerDetailPage~~ ✅ Completato

Dipende da: GS-04 (modulo presenze).

- Endpoint `GET /players/{id}/attendance` (join Attendance + TrainingSession + Group, scoping RBAC)
- Tab **Presenze** in `PlayerDetailPage`: sommario (% presenze, presenti/assenti/giustificati) + lista sessioni con stato badge

_File:_ `backend/app/schemas/attendance.py`, `backend/app/services/attendance_service.py`, `backend/app/routers/players.py`, `frontend/src/types/api.ts`, `frontend/src/api/attendance.ts`, `frontend/src/pages/PlayerDetailPage.tsx`

---

### ~~GS-13 — Record stagionale e classifica marcatori~~ ✅ Completato

- Endpoint `GET /matches/scorers` con aggregazione SQL (SUM gol/assist per giocatore, stagione, gruppo)
- Header V/P/S (vittorie/pareggi/sconfitte) in `MatchesPage`
- Tab **Partite** in `GroupDetailPage` con classifica marcatori e record stagionale

_File:_ `backend/app/routers/matches.py`, `backend/app/services/match_service.py`, `frontend/src/pages/MatchesPage.tsx`, `frontend/src/pages/GroupDetailPage.tsx`

---

### ~~GS-14 — Tab Partite in GroupDetailPage~~ ✅ Completato

- Tab **Partite** in `GroupDetailPage` con lista gare del gruppo per stagione (risultati, avversario, data)

_File:_ `frontend/src/pages/GroupDetailPage.tsx`

---

### ~~GS-15 — SeasonGroupContext in MatchesPage + marcatori cliccabili~~ ✅ Completato

- `MatchesPage` ora consuma `SeasonGroupContext` per filtrare le gare per stagione/gruppo attivi
- Marcatori nella classifica cliccabili → link a `PlayerDetailPage`

_File:_ `frontend/src/pages/MatchesPage.tsx`

---

### ~~GS-16 — Filtro disponibilità in PlayersPage + link giocatori in MatchDetailPage~~ ✅ Completato

- Filtro per stato disponibilità (disponibile / infortunato / limitato) in `PlayersPage`
- Nomi giocatori nella formazione di `MatchDetailPage` cliccabili → link a `PlayerDetailPage`

_File:_ `frontend/src/pages/PlayersPage.tsx`, `frontend/src/pages/MatchDetailPage.tsx`

---

### ~~GS-17 — Card sommario stagionale in PlayerDetailPage~~ ✅ Completato

- Card riepilogativa in cima a `PlayerDetailPage`: presenze %, gol, assist, minuti stagionali aggregati

_File:_ `frontend/src/pages/PlayerDetailPage.tsx`

---

## 7. Home Server Deployment (HS-*)

> Obiettivo: rendere l'app raggiungibile da smartphone in campo, con inserimento dati offline quando il server (PC fisso di casa) è spento, e sincronizzazione automatica alla riaccensione. Costo: zero (Cloudflare Tunnel free tier + infrastruttura esistente).

### Architettura target

```
Smartphone (campo/palestra)              PC fisso (casa)
┌──────────────────────────┐             ┌───────────────────────────┐
│  PWA installata          │             │  Docker Compose           │
│  Inserimento dati        │   HTTPS     │  ├─ Nginx (porta 80)      │
│  ↓ server non raggiung.  │ ─────────► │  │   ├─ /api → FastAPI     │
│  Coda IndexedDB          │  sync auto  │  │   └─ / → React build    │
│  (retry finché online)   │ ◄───────── │  └─ PostgreSQL             │
└──────────────────────────┘             │  cloudflared tunnel        │
                                         └───────────────────────────┘
                                                    ↕
                                         rete Cloudflare (HTTPS/SSL)
                                                    ↕
                                         dominio pubblico (es. team.example.com)
```

---

### HS-01 — Fix rilevamento "server irraggiungibile" in OfflineContext

**Problema attuale:** `OfflineContext` accoda le mutation solo quando `navigator.onLine = false`. Se lo smartphone ha connessione 4G ma il PC è spento, `navigator.onLine` rimane `true` → le mutation falliscono con errore invece di andare in coda.

**Soluzione:**
- Aggiungere endpoint leggero `GET /api/health` (no auth, risponde `{"ok": true}`)
- `OfflineContext` distingue tre stati: `online` (server raggiungibile), `server_down` (internet sì, server no), `offline` (no internet)
- Mutation fallite per errore di rete o 5xx → accoda con retry; 4xx → scarta (comportamento già corretto)
- Banner distinto: "Nessuna connessione" vs "Server non raggiungibile — dati salvati in locale"
- Ping periodico (ogni 30s) quando in stato `server_down` per rilevare il ritorno del server

_File:_ `frontend/src/context/OfflineContext.tsx`, `backend/app/routers/health.py` (nuovo), `backend/app/main.py`

---

### HS-02 — Build di produzione con Nginx

**Problema:** in sviluppo Vite dev server serve il frontend. In produzione serve un build statico servito da Nginx, con Nginx che fa anche proxy verso FastAPI — così Cloudflare Tunnel espone un solo endpoint (porta 80).

**Soluzione:**
- `Dockerfile.frontend.prod`: `npm run build` → immagine Nginx con il build in `/usr/share/nginx/html`
- `nginx.conf`: `location /api/` → proxy a `backend:8000`; tutto il resto → `index.html` (SPA routing)
- `docker-compose.prod.yml`: sostituisce il servizio `frontend` con l'immagine Nginx; rimuove `vite` e port `5173`; aggiunge variabili d'ambiente di produzione
- `.env.production` (non versionato): `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS` con il dominio Cloudflare

_File:_ `Dockerfile.frontend.prod` (nuovo), `nginx.conf` (nuovo), `docker-compose.prod.yml` (nuovo), `.env.production.example` (nuovo, versionato come template)

---

### HS-03 — Cloudflare Tunnel: setup e configurazione

**Cosa serve:**
- Account Cloudflare gratuito + dominio collegato (o sottodominio su dominio esistente)
- `cloudflared` installato sul PC fisso
- Tunnel configurato: `tuodominio.com → localhost:80` (Nginx del compose)
- CORS aggiornato: il dominio Cloudflare aggiunto a `ALLOWED_ORIGINS` in `backend/app/config.py`

**Configurazione:**
- `cloudflared/config.yml` (nel repo, template senza segreti): definisce ingress rules
- Script di avvio automatico al boot del PC (systemd su Linux, launchd su Mac, Task Scheduler su Windows)
- Documentazione in `docs/deploy/home-server.md`: step-by-step dal primo boot al dominio raggiungibile

_File:_ `cloudflared/config.yml.example` (nuovo), `docs/deploy/home-server.md` (nuovo)

---

### HS-04 — PWA offline-first: audit e raffinamento UX

**Obiettivo:** garantire che tutte le pagine di inserimento dati (sessioni, partite, presenze) siano completamente fruibili offline dopo il primo caricamento.

**Azioni:**
- Audit service worker: verifica che `SessionDetailPage`, `MatchDetailPage`, `PlayersPage` siano nella cache precache di Workbox
- Strategia cache per le API GET: `StaleWhileRevalidate` per dati relativamente statici (giocatori, gruppi); `NetworkFirst` con fallback cache per sessioni e partite
- Indicatore sync migliorato: contatore item in coda, timestamp ultimo sync riuscito, progress bar durante flush della coda
- Test manuale del flusso completo: modalità aereo → inserimento dati → riconnessione → verifica sync

_File:_ `frontend/vite.config.ts` (workbox config), `frontend/src/context/OfflineContext.tsx`, `frontend/src/components/OfflineBanner.tsx`

---

### HS-05 — Conflict resolution per sync multi-device (opzionale)

Dipende da: HS-01.

**Problema:** se due allenatori modificano lo stesso record offline e poi sincronizzano, vince l'ultimo che sincronizza (last-write-wins implicito). Per la maggior parte dei casi d'uso è accettabile; questo modulo lo rende esplicito e gestibile.

**Soluzione minima (last-write-wins esplicito):**
- Tutti i modelli hanno già `updated_at` — il backend confronta il timestamp del client con quello del DB
- Se `client.updated_at < db.updated_at` → risponde `409 Conflict` con il record corrente
- Frontend: modal "Dati più recenti disponibili sul server — vuoi sovrascrivere?" con anteprima diff

**Prerequisiti:** `updated_at` già presente sui modelli principali (da verificare).

_File:_ `backend/app/services/` (logica conflict check), `frontend/src/context/OfflineContext.tsx`, `frontend/src/components/ConflictModal.tsx` (nuovo)
