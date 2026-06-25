# FEATURE_DEVELOPMENT_GUIDE.md — Guida allo Sviluppo di Nuove Funzionalità

> Manuale operativo per mantenere il codice coerente e pulito. Seguilo sia per feature nuove che per bugfix non banali.

---

## 1. Workflow di Sviluppo

### Step 1 — Analisi

Prima di scrivere una riga di codice, rispondi a queste domande:

1. **Dove vive la feature?** È solo frontend? Richiede nuovi endpoint? Nuove tabelle?
2. **Chi può accedervi?** Quale ruolo RBAC? Tutti i gruppi o solo quelli dell'allenatore?
3. **Come influisce sui dati esistenti?** Serve una migrazione Alembic?
4. **Tocca il sottosistema observation events?** → Leggi `docs/dev/observation-events.md` **prima** di procedere.

### Step 2 — Branching

```bash
# Partire sempre da main aggiornato
git checkout main && git pull

# Naming: tipo/descrizione-breve-in-kebab
git checkout -b feat/session-export-csv
git checkout -b fix/player-streak-calculation
git checkout -b refactor/rankings-sql
```

### Step 3 — Sviluppo

Segui l'ordine: **Migrazione → Modello → Schema → Service → Router → Frontend**.  
Non saltare strati: un endpoint che fa query dirette senza passare per un service è tech debt immediato.

### Step 4 — Test

Scrivi i test prima di aprire la PR (vedi sezione Testing). Il CI (quando attivo) blocca la PR se i test falliscono.

### Step 5 — PR

- Titolo: `feat(sessions): export CSV per sessione singola`
- Body: cosa fa, perché, come testarlo manualmente
- Se tocca il DB: includi lo script di migrazione generato
- Se tocca l'auth/RBAC: specifica quali ruoli sono coinvolti

---

## 2. Convenzioni di Codice

### Backend

**Dove mettere cosa:**

| Cosa aggiungi | Dove va |
|---|---|
| Nuova tabella DB | `backend/app/models/<nome>.py` + migrazione Alembic |
| Input/output di un endpoint | `backend/app/schemas/<dominio>.py` |
| Logica di business, query complesse | `backend/app/services/<dominio>_service.py` |
| Endpoint HTTP | `backend/app/routers/<dominio>.py` |
| Guard di accesso riutilizzabile | `backend/app/rbac.py` |

**Regole inderogabili:**
- Ogni modello usa `UUID(as_uuid=True)` come PK con `default=uuid.uuid4`.
- Ogni tabella ha `created_at` con `server_default=func.now()`. Le tabelle mutabili hanno anche `updated_at` con `onupdate=func.now()`.
- Le soft delete usano `is_active: bool = True`. Non cancellare mai righe con dati storici.
- La validazione di dominio va in Pydantic (`@field_validator`), **non** in CHECK constraint o ENUM nel DB.
- I router non contengono query SQLAlchemy dirette. Delegano sempre a un service.
- Le eccezioni di dominio dai service sono `ValueError`. Il router le cattura e le converte in `HTTPException`.

**Esempio: aggiungere un endpoint**

```python
# ── routers/sessions.py ──────────────────────────────────────────────────────
@router.get("/{session_id}/export", response_class=StreamingResponse)
def export_session_csv(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)          # ← RBAC
    csv_content = SessionService(db).export_csv(session_id)      # ← Service
    return StreamingResponse(iter([csv_content]), media_type="text/csv")

# ── services/session_service.py ─────────────────────────────────────────────
def export_csv(self, session_id: uuid.UUID) -> str:
    measurements = self.get_measurements(session_id)
    # ... logica pura, testabile in isolamento
```

**Naming Python:**
- Classi: `PascalCase` → `SessionService`, `ObservationEvent`
- Funzioni/metodi/variabili: `snake_case`
- Costanti modulo: `UPPER_SNAKE_CASE` → `_METRIC_MIN_N`, `_METRIC_TO_FIELD`
- Prefisso `_` per funzioni/costanti interne al modulo che non fanno parte dell'API pubblica

**Migrazioni Alembic:**

```bash
# Dopo aver modificato un modello
make migration-new MSG="add_export_token_to_sessions"

# Verifica sempre il file generato in backend/alembic/versions/ prima di applicarlo
make migrate
```

---

### Frontend

**Dove mettere cosa:**

| Cosa aggiungi | Dove va |
|---|---|
| Chiamata HTTP a un endpoint | `frontend/src/api/<dominio>.js` |
| Aggregazione dati per una pagina specifica | `frontend/src/hooks/use<NomePagina>.js` |
| Componente riutilizzabile (>1 pagina) | `frontend/src/components/` |
| Vista intera (una route) | `frontend/src/pages/<Nome>Page.jsx` |
| Costante di dominio (tipi, labels, config) | `frontend/src/constants/domain.js` |
| Funzione pura di trasformazione dati | `frontend/src/utils/<categoria>Utils.js` |
| Nuova route | `frontend/src/App.jsx` |

**Regole:**
- Le pagine non fanno `axios.get(...)` direttamente. Usano le funzioni del modulo `api/` corrispondente.
- Le pagine con fetch multipli usano un custom hook dedicato (`hooks/use<Feature>.js`) che espone `{ data, loading, error }`.
- I componenti pesanti (report, SessionDetail) sono lazy-loaded in `App.jsx`:
  ```jsx
  const MyHeavyPage = lazy(() => import('./pages/MyHeavyPage'))
  // Wrappato in <Suspense fallback={<PageLoader />}>
  ```
- Le chiamate di scrittura (POST/PUT/DELETE) vanno negli event handler dei componenti, non negli effetti.
- Non usare `useEffect` per mutazioni; usare `useEffect` solo per sincronizzazione (fetch dati al mount).

**Naming JavaScript:**
- Componenti React: `PascalCase` → `SessionDetailPage`, `ParamCard`
- Hook: `camelCase` con prefisso `use` → `useTeamReport`, `useOnlineStatus`
- Funzioni API: `camelCase` descrittivo → `getGroupHistory()`, `upsertEvents()`
- Costanti: `UPPER_SNAKE_CASE` → `COGNITIVE_PARAMS`, `SESSION_TYPES`

**Aggiungere una route:**

```jsx
// App.jsx — lazy se la pagina importa Recharts, jsPDF, o html2canvas
const MyNewPage = lazy(() => import('./pages/MyNewPage'))

<Route
  path="/my-path"
  element={<Suspense fallback={<PageLoader />}><MyNewPage /></Suspense>}
/>
```

---

## 3. Gestione dello Stato & Dati

### Stato locale vs globale

| Tipo di stato | Dove tenerlo |
|---|---|
| Dati server per una pagina | Custom hook locale (`useState` + `useEffect`) |
| Stato auth (user, isAdmin) | `AuthContext` (già presente) |
| UI temporanea (modal aperta, form in-progress) | `useState` locale nel componente |
| Dati condivisi tra pagine | **Oggi non esiste**: refetch. Futuro: React Query (OL-04) |

### Pattern fetch standard

```jsx
// hooks/useMyFeature.js
import { useState, useEffect } from 'react'
import { getMyData } from '../api/myDomain'

export function useMyFeature(id) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getMyData(id)
      .then(res => setData(res.data))
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}
```

### Chiamate API

```js
// api/myDomain.js
import api from './axios'  // ← sempre questa istanza, mai axios diretto

export const getMyResource = (id) => api.get(`/my-resource/${id}`)
export const createMyResource = (body) => api.post('/my-resource', body)
export const updateMyResource = (id, body) => api.patch(`/my-resource/${id}`, body)
```

### Gestione errori nel componente

```jsx
const handleSubmit = async () => {
  try {
    await createMyResource(formData)
    // success feedback
  } catch (err) {
    // L'interceptor gestisce i 401 in automatico.
    // Per errori di rete offline, err.isOfflineQueued = true.
    const msg = err.response?.data?.detail || err.message || 'Errore'
    setError(msg)
  }
}
```

---

## 4. Testing

### Backend

**Framework:** `pytest` + `pytest-postgresql` (database reale, non mock)

**Struttura:**
```
backend/tests/
├── conftest.py          # Fixture: engine, tabelle, client FastAPI con TestClient
├── test_auth_login.py   # Login valido, password errata, cookie JWT
├── test_auth_setup.py   # Guards RBAC (require_admin/staff/auth), data scoping allenatore
├── test_sessions.py     # CRUD sessioni, measurements, averages
├── test_observation_events.py  # Pipeline cognitiva (il test più critico)
├── test_players.py
├── test_groups.py / test_groups_admin.py
├── test_seasons.py
└── test_middleware.py   # Header X-Request-ID, upload size limit
```

**Cosa testare obbligatoriamente:**
- ✅ Percorso felice dell'endpoint
- ✅ Autenticazione mancante → 401
- ✅ Ruolo sbagliato → 403
- ✅ Risorsa non trovata → 404
- ✅ Idempotenza per le operazioni batch (observation events: ri-salvare non duplica)

**Esempio:**
```python
def test_create_session_as_allenatore(client, db, coach_token, group):
    res = client.post(
        "/api/sessions",
        json={"group_id": str(group.id), "session_date": "2026-06-20", "session_type": "SSG"},
        headers={"Authorization": f"Bearer {coach_token}"},
    )
    assert res.status_code == 201
    assert res.json()["group_id"] == str(group.id)
```

**Esecuzione:**
```bash
cd backend && .venv/bin/pytest tests/ -v
cd backend && .venv/bin/pytest tests/test_observation_events.py -v  # solo observation
```

### Frontend

**Framework:** `vitest` + `@testing-library/react` + `axios-mock-adapter`

**Struttura:**
```
frontend/src/__tests__/
├── setup.js                    # Global setup (jsdom, @testing-library/jest-dom)
├── AuthContext.test.jsx        # Login/logout, stato utente
├── OfflineContext.test.jsx     # Offline banner, coda
├── axios.interceptors.test.js  # Redirect 401, offline queue
├── domain.test.js              # Funzioni pure in utils/domain.js
└── reportUtils.test.js         # Calcoli aggregati per i report
```

**Cosa testare obbligatoriamente:**
- ✅ Funzioni pure in `utils/` e `constants/` (nessun mock necessario)
- ✅ Interceptor Axios (usa `axios-mock-adapter`)
- ✅ Componenti che gestiscono stati complessi (auth, offline)
- ⬜ Pagine complete (opzionale, costose in manutenzione)

**Esecuzione:**
```bash
cd frontend && npm test          # Run once
cd frontend && npm run test:watch # Watch mode
```

### Observation Events — Invariante critica

Prima di ogni commit che tocca `observation_service.py`, `ObservationEvent`, o i relativi schema, verifica manualmente:

1. POST batch con dati nuovi → response aggregata corretta
2. POST batch con stessi (player, metric) → non duplica, sovrascrive
3. `normalized_score()` con `denominator=0` → restituisce `None`, non errore
4. `reliability_flag()` con `n` ai boundary (half, min, 2×min) → bande corrette

---

## 5. Checklist pre-Commit / pre-PR

Spunta ogni voce prima di aprire la PR.

### Generale
- [ ] Il branch è aggiornato con `main` (nessun conflict)
- [ ] Il titolo del commit segue `tipo(dominio): descrizione` (es. `feat(sessions): export CSV`)

### Backend
- [ ] Se ho aggiunto/modificato un modello SQLAlchemy → ho generato e verificato la migrazione (`make migration-new`)
- [ ] Se la migrazione modifica dati esistenti → è idempotente o reversibile
- [ ] La logica di business è nel service, non nel router
- [ ] Il nuovo endpoint ha il guard RBAC corretto (`require_auth` / `require_admin` + `assert_group_access` / `assert_write_access`)
- [ ] Se l'endpoint scrive dati: `responsabile_tecnico` puro riceve 403 (nessun accesso in scrittura)
- [ ] Se l'endpoint legge dati: doppio ruolo (`allenatore` + `responsabile_tecnico`) vede tutti i gruppi
- [ ] Ho aggiunto almeno il test del percorso felice e del 401/403
- [ ] `pytest tests/` passa in verde

### Frontend
- [ ] Le chiamate HTTP usano le funzioni in `api/`, non `axios` direttamente
- [ ] I componenti pesanti (Recharts, jsPDF) sono lazy-loaded
- [ ] Gli errori API sono gestiti e mostrati all'utente (nessun errore silenzioso)
- [ ] `npm test` passa in verde
- [ ] Ho verificato che la feature funziona offline (o che mostra il banner corretto)

### Observation Events (solo se tocchi questo sottosistema)
- [ ] Ho letto `docs/dev/observation-events.md` prima di iniziare
- [ ] `normalized_score()` e `reliability_flag()` restano funzioni pure su scalari
- [ ] L'aggregazione avviene con SUM **prima** della derivazione, non dopo
- [ ] Ogni evento porta `codebook_version`
- [ ] Il batch è idempotente (ri-salvare produce lo stesso risultato)
- [ ] Il test `test_observation_events.py` passa

### Security
- [ ] Nessuna credenziale, secret o dato sensibile nel codice o nei test
- [ ] I file `.env` e `users.json` **non** sono staged in git
- [ ] I nuovi endpoint che ricevono input utente hanno validazione Pydantic
- [ ] Non ho aggiunto query SQL raw (`text()`) senza parametrizzazione

### PR
- [ ] Il body della PR descrive **cosa** fa e **perché** (non solo "ho aggiunto X")
- [ ] Ho indicato come testare la feature manualmente
- [ ] Se ho introdotto una dipendenza nuova → ho spiegato perché e aggiunto a `requirements.txt` o `package.json`
