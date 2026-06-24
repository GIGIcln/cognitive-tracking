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

**[TD-04] Rankings calcolati in Python, non in SQL**  
`SessionService.get_rankings()` carica tutti i `Measurement` della sessione in memoria, calcola la media in Python, e poi ordina. Con sessioni di 30+ giocatori e 5 metriche, è accettabile. Ma è il pattern sbagliato da propagare.  
_File:_ `backend/app/services/session_service.py:135-168`

### 🟡 Media Priorità

**[TD-05] Frontend senza TypeScript**  
Tutto il frontend è in `.jsx`/`.js`. La logica di `reportUtils.js`, `domain.js` e le strutture dei dati API non sono tipizzate. Errori di forma (typo nei `field` names dei `COGNITIVE_PARAMS`) non vengono rilevati a compile-time.

**[TD-06] Gestione stato globale assente (oltre all'auth)**  
Non esiste uno store globale (Redux, Zustand, React Query). Ogni pagina fa fetch indipendente degli stessi dati (es. lista gruppi recuperata sia in `GroupsPage` che in `SessionsPage`). Nessuna cache, nessun `stale-while-revalidate`.

**[TD-07] No containerizzazione**  
Non c'è `Dockerfile` né `docker-compose.yml`. L'onboarding richiede installazione locale di Python, Node e PostgreSQL. Il `Makefile` mitiga, ma non elimina la dipendenza dall'ambiente host.

**~~[TD-08] Rate limiting non applicato ai router~~** ✅ Risolto  
`@limiter.limit("5/minute")` applicato su `/auth/login`; `60/minute` su list endpoint players e sessions; `120/minute` su endpoints di scrittura. Brute-force protetto.

### 🟢 Bassa Priorità

**[TD-09] UI non mostra `reliability_flag` all'utente**  
Il backend calcola e restituisce `reliability_flag` (`insufficient/low/medium/high`) per ogni metrica, ma il frontend non lo espone visivamente nella UI di inserimento eventi. Desiderata aperta in `docs/dev/observation-events.md`.

**[TD-10] `codebook_version=None` non gestito nel frontend**  
Quando una response aggregata mescola eventi con versioni diverse del codebook, `codebook_version` è `null`. Il frontend non distingue questo caso da `"v1"`.

---

## 3. Obiettivi a Breve Termine (1–3 mesi)

### OB-01 — CI/CD con GitHub Actions

Creare `.github/workflows/ci.yml` che esegua:
1. `pytest tests/` con un PostgreSQL effimero (service container)
2. `npm test` nel frontend
3. Linting: `ruff` (backend) + `eslint` (frontend)
4. Build del frontend (`npm run build`) come smoke test

Beneficio immediato: ogni PR è validata automaticamente. Zero effort per i test esistenti (già scritti).

### ~~OB-02 — Rate Limiting attivo~~ ✅ Completato

`@limiter.limit("5/minute")` su `/auth/login`; 60/minute su list endpoint; 120/minute su mutation. Applicato a `auth.py`, `players.py`, `sessions.py`.

### OB-03 — UI di `reliability_flag`

Mostrare il badge di affidabilità (`insufficient/low/medium/high`) nell'UI di inserimento eventi e nei report. Mappare i valori su colori (rosso/arancio/giallo/verde). Bloccare la pubblicazione se `insufficient`.  
_Reference:_ `docs/dev/observation-events.md` § Fili aperti.

### OB-04 — Rankings in SQL

Riscrivere `get_rankings()` usando `func.avg()` + `ORDER BY` SQL-side:

```python
from sqlalchemy import case, func, nullslast

db.query(
    Player.id,
    Player.first_name,
    Player.last_name,
    func.avg(
        (Measurement.scanning_rate + Measurement.decision_quality + ...) / 5
    ).label("avg_score"),
).join(...).group_by(Player.id).order_by(nullslast(desc("avg_score")))
```

_File target:_ `backend/app/services/session_service.py`

### OB-05 — Docker Compose per sviluppo locale

`docker-compose.yml` con servizi `db` (postgres:15), `backend` e `frontend`. Elimina i prerequisiti locali e uniforma l'ambiente tra sviluppatori.

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
| **Rankings** | Calcolo Python in memoria | ⚠️ Riscrivere SQL (OB-04) |
| **GZip** | Attivo per response > 1KB | ✅ Presente |
| **Frontend lazy loading** | Pagine pesanti (report, SessionDetail) caricate on-demand | ✅ Presente |
| **PDF export** | `html2canvas` è lento su DOM complesso | Valutare generazione server-side (WeasyPrint) |
| **Offline** | Mutation code in coda IndexedDB | ✅ Operativo |
