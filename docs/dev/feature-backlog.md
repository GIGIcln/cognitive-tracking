# Feature Backlog — Cognitive Tracking

> Guida tecnica per sviluppare le funzionalità pianificate.
> Per ogni feature: cosa c'è già, cosa manca, dove lavorare.

---

## 1. Reliability gate visibile in modalità eventi

**Complessità:** bassa · **Backend:** no · **Frontend:** `SessionDetailPage.jsx`

### Cosa c'è già

- Il backend calcola `reliability_flag` (`insufficient / low / medium / high`) in ogni `ObservationEventResponse`.
- La SessionDetailPage ha già la modalità "Conteggio eventi" con `entryMode === 'event'`.
- I flag arrivano nel payload ma non vengono mostrati all'utente.

`docs/dev/observation-events.md` segna esplicitamente come aperto: _"UI: mostrare il nuovo `n` di SR in ricezioni + gate '≥ medium'"_.

### Cosa manca

Un badge per metrica che mostri il flag di affidabilità calcolato e blocchi visivamente il salvataggio se tutte le metriche con dati sono sotto `medium`.

### Implementazione

```jsx
// Mappa colori per flag
const RELIABILITY_COLORS = {
  insufficient: 'bg-red-100 text-red-600',
  low:          'bg-orange-100 text-orange-600',
  medium:       'bg-yellow-100 text-yellow-700',
  high:         'bg-green-100 text-green-700',
}

// Badge da rendere sotto ogni campo numeratore/denominatore in event mode
{ev.reliability_flag && (
  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                   ${RELIABILITY_COLORS[ev.reliability_flag]}`}>
    {ev.reliability_flag} · n={ev.n}
  </span>
)}
```

Il valore `n` è già nella response degli eventi aggregati (dopo save). Prima del save, calcolarlo client-side:
- SR: `COUNT` delle righe inserite
- DQI/TRS/VCI: `SUM(denominator)`
- AI: `SUM(numerator)`

Aggiungere un warning banner se la media dei flag è sotto `medium`:
```jsx
{belowGate && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
    Dati insufficienti per la pubblicazione — raccogliere più eventi prima di salvare.
  </div>
)}
```

---

## 2. Confronto giocatori side-by-side

**Complessità:** media · **Backend:** no · **Frontend:** nuova pagina `PlayerComparePage.jsx`

### Cosa c'è già

- `GET /players/{id}/history` esiste e restituisce lo storico sessioni con punteggi.
- Recharts `LineChart` già usato in `PlayerDetailPage.jsx`.

### Cosa manca

Una pagina che carica la history di 2–3 giocatori in parallelo e li affianca su un grafico per metrica.

### Implementazione

**Route:** aggiungere in `App.jsx`:
```jsx
<Route path="/players/compare" element={<PlayerComparePage />} />
```

**Stato:**
```js
const [ids, setIds] = useState([])          // UUID selezionati
const [histories, setHistories] = useState({})  // { [playerId]: [...] }
```

**Costruzione dati per grafico:**
Unire le sessioni per data ISO e creare un dataset comune. Ogni giocatore diventa una `<Line>` separata.
```js
// Tutte le date uniche, ordinate
const dates = [...new Set(Object.values(histories).flatMap(h => h.map(s => s.date)))].sort()

const chartData = dates.map(date => {
  const row = { date }
  ids.forEach(id => {
    const entry = histories[id]?.find(s => s.date === date)
    row[id] = entry?.[selectedMetric] ?? null
  })
  return row
})
```

**Entry point:** bottone "Confronta" in `PlayersPage.jsx` che appare quando sono selezionati 2–3 giocatori (riutilizzare la checkbox infrastructure del bulk assign).

---

## 3. Trend di gruppo nel tempo

**Complessità:** media · **Backend:** nuovo endpoint · **Frontend:** `GroupDetailPage.jsx`

### Cosa c'è già

- `GroupDetailPage` ha tab con statistiche per giocatore (`playerStats`) ma nessun grafico temporale del gruppo.
- Recharts già importato nel progetto.

### Cosa manca

Endpoint che aggrega le medie del gruppo sessione per sessione, e un grafico a linee nella tab Statistiche.

### Backend — nuovo endpoint

**File:** `backend/app/routers/groups.py`

```python
@router.get("/{group_id}/trend")
def get_group_trend(
    group_id: uuid.UUID,
    season_id: Optional[uuid.UUID] = Query(default=None),
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    from app.models.training_session import TrainingSession
    from app.models.measurement import Measurement
    from sqlalchemy import func

    q = db.query(
        TrainingSession.session_date,
        TrainingSession.session_type,
        func.avg(Measurement.scanning_rate).label("avg_sr"),
        func.avg(Measurement.decision_quality).label("avg_dqi"),
        func.avg(Measurement.anticipation).label("avg_ai"),
        func.avg(Measurement.transition_reset).label("avg_trs"),
        func.avg(Measurement.verbal_comm).label("avg_vci"),
        func.count(Measurement.player_id).label("n_players"),
    ).join(Measurement, Measurement.session_id == TrainingSession.id).filter(
        TrainingSession.group_id == group_id,
        TrainingSession.is_active.is_(True),
        Measurement.is_absent.is_(False),
    )
    if season_id:
        q = q.filter(TrainingSession.season_id == season_id)

    rows = q.group_by(
        TrainingSession.session_date,
        TrainingSession.session_type,
    ).order_by(TrainingSession.session_date).all()

    def f(v): return round(float(v), 2) if v is not None else None

    return [
        {
            "date":       str(r.session_date),
            "type":       r.session_type,
            "n_players":  r.n_players,
            "avg_sr":     f(r.avg_sr),
            "avg_dqi":    f(r.avg_dqi),
            "avg_ai":     f(r.avg_ai),
            "avg_trs":    f(r.avg_trs),
            "avg_vci":    f(r.avg_vci),
        }
        for r in rows
    ]
```

### Frontend

Nuova tab "Trend" in `GroupDetailPage` con un `LineChart` a 5 linee (una per metrica).
Toggle pills per filtrare per tipo sessione (All / Allenamento / Partita / Test).

---

## 4. Filtro per tipo di sessione nella storia giocatore

**Complessità:** bassa · **Backend:** no · **Frontend:** `PlayerDetailPage.jsx`

### Cosa c'è già

`PlayerDetailPage` mostra un `LineChart` con tutte le sessioni. Ogni punto ha `session_type` nella history.

### Cosa manca

Un toggle pills `Tutte | Allenamento | Partita | Test` sopra il grafico che filtra `chartData` client-side.

### Implementazione

```jsx
const [typeFilter, setTypeFilter] = useState('all')

const filteredHistory = typeFilter === 'all'
  ? history
  : history.filter(s => s.session_type === typeFilter)
```

```jsx
{['all', 'training', 'match', 'test'].map(t => (
  <button
    key={t}
    onClick={() => setTypeFilter(t)}
    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
               ${typeFilter === t
                 ? 'bg-granata text-white'
                 : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
  >
    {{ all: 'Tutte', training: 'Allenamento', match: 'Partita', test: 'Test' }[t]}
  </button>
))}
```

Quando `filteredHistory` è vuoto, mostrare `"Nessuna sessione di questo tipo"` al posto del grafico.

---

## 5. Esportazione raw eventi di osservazione

**Complessità:** bassa · **Backend:** nuovo endpoint · **Frontend:** `SessionDetailPage.jsx`

### Cosa c'è già

- `GET /sessions/{id}/events` restituisce la lista completa degli eventi.
- `exportUtils.js` ha già le utility per generare e scaricare CSV.

### Cosa manca

Un endpoint dedicato all'export (o riusare quello esistente) e un bottone di download nella UI.

### Backend — nuovo endpoint

**File:** `backend/app/routers/sessions.py`

```python
from fastapi.responses import StreamingResponse
import csv, io

@router.get("/{session_id}/events/export")
def export_events_csv(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    events = db.query(ObservationEvent).filter(
        ObservationEvent.session_id == session_id
    ).order_by(ObservationEvent.player_id, ObservationEvent.metric_type).all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "player_id", "metric_type", "numerator", "denominator",
        "video_ref", "codebook_version", "created_at",
    ])
    for e in events:
        w.writerow([
            e.player_id, e.metric_type, e.numerator, e.denominator,
            e.video_ref, e.codebook_version, e.created_at.isoformat(),
        ])

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=events_{session_id}.csv"},
    )
```

### Frontend

Bottone "Esporta eventi CSV" in `SessionDetailPage.jsx` — visibile solo se `entryMode === 'event'` e ci sono eventi salvati.

```jsx
<a
  href={`${API_BASE}/sessions/${id}/events/export`}
  download
  className="text-sm text-gray-500 hover:text-granata flex items-center gap-1"
>
  ↓ Esporta eventi CSV
</a>
```

---

## 6. Percentuale presenze per giocatore

**Complessità:** bassa · **Backend:** nuovo endpoint · **Frontend:** `PlayerDetailPage.jsx`

### Cosa c'è già

- `GroupDetailPage` mostra la tab Presenze (sessioni recenti per giocatore).
- `Measurement.is_absent` esiste su ogni record.

### Cosa manca

Un endpoint che calcola il riepilogo presenze di un singolo giocatore e un badge nel suo profilo.

### Backend — nuovo endpoint

**File:** `backend/app/routers/players.py`

```python
@router.get("/{player_id}/attendance-summary")
def get_attendance_summary(
    player_id: uuid.UUID,
    season_id: Optional[uuid.UUID] = Query(default=None),
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    from app.models.measurement import Measurement
    from app.models.training_session import TrainingSession

    q = db.query(Measurement).join(
        TrainingSession, Measurement.session_id == TrainingSession.id
    ).filter(
        Measurement.player_id == player_id,
        TrainingSession.is_active.is_(True),
    )
    if season_id:
        q = q.filter(TrainingSession.season_id == season_id)

    records = q.all()
    total = len(records)
    present = sum(1 for r in records if not r.is_absent)

    return {
        "total_sessions": total,
        "present": present,
        "absent": total - present,
        "attendance_pct": round(present / total * 100, 1) if total > 0 else None,
    }
```

### Frontend

Badge nell'header di `PlayerDetailPage.jsx`, accanto al nome:

```jsx
{attendance && attendance.total_sessions > 0 && (
  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                   ${attendance.attendance_pct >= 80
                     ? 'bg-green-100 text-green-700'
                     : attendance.attendance_pct >= 60
                       ? 'bg-yellow-100 text-yellow-700'
                       : 'bg-red-100 text-red-600'}`}>
    {attendance.attendance_pct}% presenze ({attendance.present}/{attendance.total_sessions})
  </span>
)}
```

---

## 7. Ranking giocatore dentro il gruppo

**Complessità:** bassa · **Backend:** no · **Frontend:** `PlayerDetailPage.jsx`

### Cosa c'è già

- `GET /sessions/{id}/rankings` restituisce la classifica dei giocatori per una sessione.
- `PlayerDetailPage` già conosce il gruppo corrente del giocatore e l'ultima sessione.

### Cosa manca

Fetchare il ranking dell'ultima sessione comune, trovare la posizione del giocatore corrente e mostrarla.

### Implementazione

```js
// Recuperare l'ultima sessione del gruppo e il ranking
const rankRes = await api.get(`/sessions/${lastSessionId}/rankings`)
const rank = rankRes.data.findIndex(r => r.player_id === id) + 1
const total = rankRes.data.length
setRank({ pos: rank, total })
```

```jsx
{rank && (
  <span className="text-xs text-gray-500">
    #{rank.pos} su {rank.total} nell'ultima sessione
  </span>
)}
```

---

## 8. Confronto stagioni (anno su anno)

**Complessità:** media · **Backend:** no · **Frontend:** `SeasonsPage.jsx`

### Cosa c'è già

- `GET /seasons/{id}/stats` (implementato) restituisce metriche aggregate per stagione.
- `SeasonsPage` già carica tutte le stagioni.

### Cosa manca

Caricare le stats di tutte le stagioni (non solo la corrente) e renderle in una tabella comparativa.

### Implementazione

```js
// Caricare stats per ogni stagione in parallelo
const allStats = await Promise.all(
  seasons.map(s => getSeasonStats(s.id).then(r => ({ ...r.data, season: s })))
)
setSeasonStats(allStats)
```

Tabella comparativa con una riga per stagione e colonne `Sessioni | Giocatori | SR | DQI | AI | TRS | VCI`.
Evidenziare in verde i valori più alti per ogni metrica rispetto alle stagioni precedenti.

---

## 9. Radar chart snapshot sessione

**Complessità:** bassa · **Backend:** no · **Frontend:** `SessionDetailPage.jsx`

### Cosa c'è già

- `GET /sessions/{id}/averages` restituisce la media del gruppo per ogni metrica.
- I `GroupTarget` sono disponibili via `GET /groups/{id}`.
- Recharts include `RadarChart`, `Radar`, `PolarGrid`, `PolarAngleAxis`.

### Cosa manca

Un pannello collassabile in fondo a `SessionDetailPage` che mostri il radar dopo il salvataggio.

### Implementazione

```jsx
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const radarData = METRICS.map(({ key, label }) => ({
  metric: label,
  valore: averages?.[key] ?? 0,
  target: targets.find(t => t.parameter === key)?.ottimo_min ?? 8,
}))

<ResponsiveContainer width="100%" height={280}>
  <RadarChart data={radarData}>
    <PolarGrid />
    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
    <PolarRadiusAxis domain={[0, 10]} tick={false} />
    <Radar name="Gruppo" dataKey="valore" stroke="#7f1d1d" fill="#7f1d1d" fillOpacity={0.3} />
    <Radar name="Target" dataKey="target" stroke="#9ca3af" fill="none" strokeDasharray="4 2" />
  </RadarChart>
</ResponsiveContainer>
```

---

## 10. Note di sessione a livello team

**Complessità:** bassa · **Backend:** migrazione DB + schema · **Frontend:** `SessionDetailPage.jsx`

### Cosa c'è già

- `TrainingSession` ha i campi principali ma non un campo `notes` per il coach.
- `Measurement.notes` esiste per note per giocatore.

### Cosa manca

Campo `notes TEXT` su `TrainingSession`, schema Pydantic aggiornato, PATCH endpoint, e textarea nella UI.

### Backend

**Migrazione Alembic:**
```python
op.add_column('training_sessions', sa.Column('notes', sa.Text(), nullable=True))
```

**Schema** `SessionUpdate` — aggiungere `notes: Optional[str] = None`.

**Router** — il `PATCH /{session_id}` esistente in `sessions.py` già chiama `update_session`; aggiungere `notes` al modello `SessionUpdate`.

### Frontend

Textarea in fondo all'header della sessione (sopra la lista giocatori):

```jsx
<textarea
  value={sessionNotes}
  onChange={(e) => setSessionNotes(e.target.value)}
  onBlur={handleSaveSessionNotes}
  placeholder="Note generali sulla sessione (facoltativi)…"
  rows={2}
  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
             text-gray-600 focus:outline-none focus:ring-2 focus:ring-granata resize-none"
/>
```

Salvataggio `onBlur` tramite `PATCH /sessions/{id}` con `{ notes: sessionNotes }`.

---

## Ordine suggerito

| # | Feature | Stima | Dipendenze |
|---|---------|-------|------------|
| 1 | Reliability gate visibile | 1h | — |
| 4 | Filtro tipo sessione player | 30 min | — |
| 7 | Ranking giocatore nel gruppo | 45 min | — |
| 9 | Radar chart sessione | 1h | — |
| 10 | Note sessione team | 1h | migrazione DB |
| 6 | Percentuale presenze | 1h | nuovo endpoint |
| 5 | Export raw eventi CSV | 1h | nuovo endpoint |
| 3 | Trend di gruppo | 1.5h | nuovo endpoint |
| 8 | Confronto stagioni | 1h | — |
| 2 | Confronto giocatori | 2h | — |
