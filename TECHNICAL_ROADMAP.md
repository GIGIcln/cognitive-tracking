# TECHNICAL_ROADMAP.md — Roadmap Tecnica Cognitive Tracking

> Basata sull'analisi dello stato attuale del codice (giugno 2026). Aggiorna questa sezione quando una voce viene chiusa o cambia priorità.

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

**[TD-01] Auth file-based non scalabile (`users.json`)**  
Attualmente gli utenti sono in un file JSON caricato in memoria all'avvio. Aggiungere o modificare un utente richiede di editare il file e ricaricare il server (`user_store.reload()`). Non c'è UI di gestione, no audit log degli accessi, no reset password self-service.  
_File:_ `backend/app/user_store.py`, `backend/users.json`

**[TD-02] SQLAlchemy sincrono in un'app FastAPI asincrona**  
FastAPI è costruito su Starlette/asyncio ma il motore è sincrono (`create_engine`, `sessionmaker` senza `async`). Sotto carico ogni query blocca un thread del pool. Non è un problema ora (utenti pochi, query veloci), ma limita la scalabilità futura.  
_File:_ `backend/app/database.py`

**[TD-03] Nessun sistema di CI/CD**  
Non esiste `.github/workflows/` o equivalente. I test vengono eseguiti solo manualmente. Un push rotto sul branch main non viene rilevato automaticamente.

**~~[TD-04] Rankings calcolati in Python, non in SQL~~** ✅ Risolto  
Riscritto con aggregazione SQL-side (`func.coalesce`, `cast`, `desc`): il DB calcola la media riga-per-riga sui campi non-NULL e ordina; Python riceve solo la lista già ordinata.  
_File:_ `backend/app/services/session_service.py`

### 🟡 Media Priorità

**[TD-05] Frontend senza TypeScript**  
Tutto il frontend è in `.jsx`/`.js`. La logica di `reportUtils.js`, `domain.js` e le strutture dei dati API non sono tipizzate. Errori di forma (typo nei `field` names dei `COGNITIVE_PARAMS`) non vengono rilevati a compile-time.

**[TD-06] Gestione stato globale assente (oltre all'auth)**  
Non esiste uno store globale (Redux, Zustand, React Query). Ogni pagina fa fetch indipendente degli stessi dati (es. lista gruppi recuperata sia in `GroupsPage` che in `SessionsPage`). Nessuna cache, nessun `stale-while-revalidate`.

**~~[TD-07] No containerizzazione~~** ✅ Risolto  
`docker-compose.yml` con servizi `db` (postgres:15), `backend` e `frontend`. Hot-reload su entrambi; `alembic upgrade head` eseguito automaticamente all'avvio del backend.

**~~[TD-08] Rate limiting non applicato ai router~~** ✅ Risolto  
`@limiter.limit("5/minute")` applicato su `/auth/login`; `60/minute` su list endpoint players e sessions; `120/minute` su endpoints di scrittura. Brute-force protetto.

**[TD-11] Definizioni delle metriche sparse in 5+ sorgenti**  
Le 5 metriche cognitive (SR, DQI, AI, TRS, VCI) sono definite in modo ridondante in: `frontend/src/constants/domain.js` (`COGNITIVE_PARAMS` + `METRIC_EVENT_CONFIG`), `PlayerDetailPage.jsx`, `GroupDetailPage.jsx`, `exportUtils.js` (due definizioni inline distinte), e `backend/app/services/observation_service.py` (`_METRIC_MIN_N`, `_METRIC_TO_FIELD`). Un cambio di etichetta o soglia richiede aggiornamenti in ≥5 file senza garanzie di coerenza.  
_File:_ `frontend/src/constants/domain.js`, `frontend/src/pages/{Player,Group}DetailPage.jsx`, `frontend/src/utils/exportUtils.js`, `backend/app/services/observation_service.py`

**[TD-12] Reliability preview SR disallineata tra frontend e backend**  
Il backend calcola la reliability di SR su `COUNT(righe)` con soglia `min_n=6` (ricezioni = eventi registrati). Il frontend in `deriveReliability()` usa `denominator` dell'evento corrente con `min_n=15` (ricezioni in pressione per evento). La semantica è diversa: l'utente vede un badge di affidabilità durante l'inserimento che non corrisponde al valore definitivo calcolato dal backend. Filo aperto già registrato in `docs/dev/observation-events.md`.  
_File:_ `frontend/src/constants/domain.js:38`, `backend/app/services/observation_service.py:18`

**[TD-13] `SessionDetailPage` monolite (930+ righe)**  
La pagina gestisce contemporaneamente: caricamento di sessione, giocatori, target e misurazioni; due modalità di input (score vs event); calcolo affidabilità in-page con 3 helper locali; dirty tracking + `useBlocker` + `beforeunload`; rendering mobile (≈590 linee) e desktop (≈270 linee). `EventParamRow` (113 righe) e `NotesBlock` (60 righe) sono funzioni inline anziché componenti. Non è un problema urgente, ma rende la pagina difficile da testare e modificare in sicurezza.  
_File:_ `frontend/src/pages/SessionDetailPage.jsx`

**[TD-14] Offline queue senza tetto di retry e cleanup**  
`offlineQueue.js` accoda mutation offline con retry esponenziale, ma non ha un limite massimo di tentativi né un meccanismo di discard per item bloccati. Un evento corrotto può restare in coda IndexedDB indefinitamente, consumare storage e continuare a ritentare ad ogni online event. L'interceptor in `axios.js` non propaga al componente il caso di errore permanente.  
_File:_ `frontend/src/utils/offlineQueue.js`, `frontend/src/api/axios.js`

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

### OL-02 — Migrazione Auth su PostgreSQL

Spostare `users.json` in una tabella `users` nel DB, con:
- Endpoint admin per CRUD utenti (`POST /api/admin/users`)
- Password reset via token (email o one-time code)
- Audit log degli accessi (ultima login, IP)
- `is_active` gestibile dinamicamente senza riavvio

Mantiene lo stesso pattern JWT (roles/group_ids embedded), elimina la fragilità operativa.

### OL-03 — Frontend TypeScript

Migrare `*.jsx`/`*.js` a `*.tsx`/`*.ts`. Priorità:
1. `constants/domain.js` → tipi per `CognitiveParam`, `MetricEventConfig`
2. `utils/reportUtils.js` → tipi per `Measurement`, `Target`, `History`
3. `api/*.js` → tipi request/response allineati agli schema Pydantic

Riduce i bug di runtime causati da typo nei field name delle strutture dati.

### OL-04 — Gestione stato globale con React Query (TanStack Query)

Sostituire i custom hook con `useQuery` / `useMutation`. Benefici:
- Cache automatica e deduplicazione delle request
- `stale-while-revalidate` (UI aggiornata senza spinner)
- Retry automatico con backoff esponenziale
- Integrazione nativa con `isLoading`, `isError`, `isFetching`

### OL-05 — E2E Testing con Playwright

Aggiungere test E2E per i flussi critici:
- Login → creazione sessione → inserimento observation events → export PDF
- Verifica del gate di affidabilità (`insufficient` → blocco pubblicazione)

### OL-06 — PDF generation server-side (WeasyPrint)

`exportUtils.js` usa `html2canvas` che è sincrono, blocca il main thread e scala male su report con molti giocatori (hide/show DOM, loop su sections, nessun progress indicator). Migrazione a generazione server-side con WeasyPrint: il backend riceve la request, renderizza HTML → PDF in Python, restituisce il file come `application/pdf`. Benefici: thread UI libero, output deterministico, possibilità di schedulare la generazione in background. Da coordinare con OL-02 (auth su DB) per gestire accesso sicuro al report.  
_File:_ `frontend/src/utils/exportUtils.js`

### OL-07 — Refactoring `SessionDetailPage` in componenti e custom hook

Estrarre dalla pagina monolite (930+ righe):
1. `EventParamRow` → componente autonomo in `components/`
2. `NotesBlock` → componente autonomo in `components/`
3. `useSessionForm()` → custom hook che gestisce stato e side effect (caricamento dati, dirty tracking, salvataggio), lasciando alla pagina solo la composizione UI
4. Split del rendering mobile/desktop in sub-component o slot-pattern

Pre-requisito naturale per il passaggio a TypeScript (OL-03) perché riduce la superficie di ciascun file da tipizzare.  
_File:_ `frontend/src/pages/SessionDetailPage.jsx`

### OL-09 — Workflow SR multi-riga e allineamento reliability

Il codebook v1 specifica `una riga = una ricezione` per SR (denominator = durata finestra in secondi). Il frontend usa una riga aggregata (denominator = ricezioni totali), semantica incompatibile con il backend che calcola `n = COUNT(rows)`. La fix richiede:
1. Aggiornare `METRIC_EVENT_CONFIG.scanning_rate.denominator_label` a "Durata finestra (sec)"
2. Supportare l'inserimento di **multiple righe SR** nell'UI (`SessionDetailPage`) — una per ricezione
3. Aggiornare la live preview reliability per SR: usare `COUNT(righe SR in inserimento)` con `min_n=6`
4. Aggiornare `deriveScore('SR')` per gestire il nuovo denominator (secondi → scansioni/sec invece di scansioni/ricezione)

Sforzo medio. Pre-requisito: nessun dato reale ancora registrato (le definizioni sono congelate al primo dato).  
_File:_ `frontend/src/constants/domain.js`, `frontend/src/pages/SessionDetailPage.jsx`

### OL-08 — Fonte unica di verità per le definizioni di metrica

Consolidare le 5 definizioni sparse di SR/DQI/AI/TRS/VCI in una sola sorgente:
- **Frontend:** `domain.js` diventa l'unico owner di `field`, `label`, `min_n`, `avgKey`, `color`, `metric_type`. Eliminare le definizioni inline in `PlayerDetailPage`, `GroupDetailPage`, `exportUtils.js`.
- **Backend:** `_METRIC_MIN_N` e `_METRIC_TO_FIELD` in `observation_service.py` rimangono come authoritative source lato Python, ma vengono esposti tramite un endpoint `/api/meta/metrics` (JSON) per permettere al frontend di leggere le soglie live anziché duplicarle.
- Risultato: un cambio di soglia richiede una modifica in un solo file Python; il frontend si adegua automaticamente.

Sforzo medio; sblocca una più facile gestione di future versioni del codebook (v2+).  
_File:_ `backend/app/services/observation_service.py`, `frontend/src/constants/domain.js`, pagine interessate

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
| **users.json** | File su disco, fuori dal repo | ⚠️ Soluzione temporanea — vedere OL-02 |
| **Audit log** | Login riusciti/falliti loggati con `request_id`; `GroupChangeLog` per spostamenti | Estendere a audit per-utente con OL-02 |

### Performance

| Area | Stato attuale | Azione |
|---|---|---|
| **Pool DB** | `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True` | ✅ Adeguato per uso attuale |
| **Indici DB** | Migrazioni 0002 e 0003 aggiungono indici performance | ✅ Presenti |
| **Aggregazioni SQL** | `func.avg()` usato in `get_averages()` | ✅ Corretto |
| **Rankings** | `func.coalesce` + `desc` SQL-side in `get_rankings()` | ✅ SQL-side (OB-04) |
| **GZip** | Attivo per response > 1KB | ✅ Presente |
| **Frontend lazy loading** | Pagine pesanti (report, SessionDetail) caricate on-demand | ✅ Presente |
| **PDF export** | `html2canvas` è lento su DOM complesso; sincrono, nessun progress indicator | Migrazione server-side WeasyPrint — vedere OL-06 |
| **Offline** | Mutation code in coda IndexedDB | ✅ Operativo |
