import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { COGNITIVE_PARAMS, FIELD_TO_METRIC } from '../constants/domain'
import type { MetricField } from '../constants/domain'
import { formatDateLong } from '../utils/dateUtils'
import ToggleSwitch from '../components/ToggleSwitch'
import NotesBlock from '../components/NotesBlock'
import EventParamRow from '../components/EventParamRow'
import SRMultiRowInput from '../components/SRMultiRowInput'
import AttendanceTab from '../components/AttendanceTab'
import { useSessionForm } from '../hooks/useSessionForm'
import type { GroupTarget } from '../utils/reportUtils'

const PARAMS = COGNITIVE_PARAMS

// ── Score-mode helpers ────────────────────────────────────────────────────────

function valueBadgeClass(value: string | number | null, targetsMap: Record<string, GroupTarget>, field: MetricField) {
  const param = FIELD_TO_METRIC[field]
  const t = targetsMap[param]
  if (!t || value === '' || value == null) return 'border-gray-300 bg-white'
  const v = parseFloat(String(value))
  if (v <= t.insufficient_max) return 'border-red-300 bg-red-50 text-red-800'
  if (v >= t.ottimo_min)       return 'border-green-300 bg-green-50 text-green-800'
  return 'border-yellow-300 bg-yellow-50 text-yellow-800'
}

function getMobileBtnClass(n: number, selectedValue: string | number | null, targetsMap: Record<string, GroupTarget>, field: MetricField) {
  const isSelected = Number(selectedValue) === n
  if (!isSelected) return 'bg-gray-100 text-gray-600 active:bg-gray-200'
  const param = FIELD_TO_METRIC[field]
  const t = targetsMap[param]
  if (!t) return 'bg-granata text-white scale-105'
  if (n <= t.insufficient_max) return 'bg-granata text-white scale-105 ring-2 ring-red-400 ring-offset-1'
  if (n >= t.ottimo_min)       return 'bg-granata text-white scale-105 ring-2 ring-green-400 ring-offset-1'
  return 'bg-granata text-white scale-105 ring-2 ring-yellow-400 ring-offset-1'
}

function ReliabilityChip({ ok, total }: { ok: number; total: number }) {
  let cls
  if (ok >= total)                     cls = 'bg-green-100 text-green-700'
  else if (ok >= Math.ceil(total / 2)) cls = 'bg-yellow-100 text-yellow-700'
  else                                 cls = 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {ok}/{total}
    </span>
  )
}

function ScoreCompletenessChip({ filled, total }: { filled: number; total: number }) {
  let cls
  if (filled === total && total > 0) cls = 'bg-green-100 text-green-700'
  else if (filled === 0)             cls = 'bg-red-100 text-red-700'
  else                               cls = 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {filled}/{total}
    </span>
  )
}

export default function SessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [section, setSection] = useState('presenze')

  const {
    session, players, targetsMap, measurements, eventData, srRows,
    entryMode, setEntryMode,
    loading, saving, error, saveOk,
    currentIndex, editingNotes, setEditingNotes, notesValue, setNotesValue,
    savingNotes, mixedVersionWarning, blocker,
    currentPlayer, currentM, total,
    handleChange, toggleAbsent, handleSave,
    handleEventChange, handleEventSet,
    addSRRow, updateSRRow, deleteSRRow,
    handleSaveNotes,
    goToNext, goToPrev,
    getReliabilityOkCount, hasAnyEventData,
    insufficientCount, insufficientGateCount,
    getScoreFilledCount, scoreEmptyCount,
  } = useSessionForm(id!)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-granata border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <div className="text-red-600 text-sm">{error || 'Sessione non trovata'}</div>
  }

  return (
    <>
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Modifiche non salvate</h3>
            <p className="text-sm text-gray-600 mb-5">
              Hai dati inseriti che non sono ancora stati salvati. Se esci ora li perderai.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Resta
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700"
              >
                Esci senza salvare
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden pb-40">
        {/* Sticky header */}
        <div className="sticky top-0 -mx-4 px-4 bg-white z-10 pb-3 pt-1 mb-4 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => navigate('/sessions')}
              className="text-gray-400 text-lg p-1 -ml-1 flex items-center justify-center"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">
                {session.session_type}
                {session.duration_min && ` · ${session.duration_min} min`}
              </h1>
              <div className="text-xs text-gray-500">{formatDateLong(session.session_date)}</div>
            </div>
          </div>

          {/* Report link — mobile */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => navigate(`/reports/session/${id}`)}
              className="text-xs font-bold text-granata border border-granata/30 rounded-lg px-3 py-1.5 hover:bg-granata/5 transition-colors"
            >
              Report sessione →
            </button>
          </div>

          {/* Note sessione — mobile */}
          <NotesBlock
            notes={session.notes}
            editing={editingNotes}
            value={notesValue}
            saving={savingNotes}
            onChange={setNotesValue}
            onEdit={() => setEditingNotes(true)}
            onSave={handleSaveNotes}
            onCancel={() => { setEditingNotes(false); setNotesValue(session.notes ?? '') }}
          />

          {/* Section tabs */}
          <div className="flex border-b border-gray-200 mt-1">
            {[
              { key: 'presenze', label: 'Presenze' },
              { key: 'cognitivo', label: 'Cognitivo' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  section === key
                    ? 'border-granata text-granata'
                    : 'border-transparent text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mode toggle — only in cognitivo tab */}
          {section === 'cognitivo' && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mt-2">
              {[['score', 'Punteggio'], ['event', 'Conteggio eventi']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setEntryMode(mode as 'score' | 'event')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    entryMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Cognitivo: progress bar only when on cognitivo tab */}
          {section === 'cognitivo' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500 shrink-0">
                Giocatore {currentIndex + 1} di {total}
              </span>
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-granata h-1.5 rounded-full transition-all duration-300"
                  style={{ width: total ? `${((currentIndex + 1) / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Presenze tab */}
        {section === 'presenze' && (
          <AttendanceTab sessionId={id!} players={players} />
        )}

        {/* Cognitivo tab */}
        {section === 'cognitivo' && (
          <>
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{error}</div>
        )}
        {saveOk && (
          <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4 border border-green-200 text-center font-medium">
            ✓ Sessione salvata
          </div>
        )}
        {mixedVersionWarning && (
          <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-lg mb-4 border border-amber-200">
            Attenzione: questa sessione contiene dati raccolti con versioni diverse del codebook. I parametri potrebbero non essere direttamente confrontabili.
          </div>
        )}

        {/* Player card */}
        {currentPlayer && currentM ? (
          <div className={`rounded-xl border p-4 transition-colors ${currentM.is_absent ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-semibold text-gray-900 leading-tight">
                {currentPlayer.last_name} {currentPlayer.first_name}
              </span>
              <div className="flex items-center gap-2 select-none shrink-0 ml-3">
                {entryMode === 'event' && !currentM.is_absent && hasAnyEventData(currentPlayer.id) && (
                  <ReliabilityChip ok={getReliabilityOkCount(currentPlayer.id)} total={PARAMS.length} />
                )}
                {entryMode === 'score' && !currentM.is_absent && (
                  <ScoreCompletenessChip filled={getScoreFilledCount(currentPlayer.id)} total={PARAMS.length} />
                )}
                <span className="text-sm text-gray-500">Assente</span>
                <ToggleSwitch
                  checked={currentM.is_absent}
                  onChange={() => toggleAbsent(currentPlayer.id)}
                  size="md"
                />
              </div>
            </div>

            {currentM.is_absent ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                Giocatore assente — nessun dato da inserire
              </div>
            ) : entryMode === 'score' ? (
              <div>
                {PARAMS.map(({ italianLabel, field }) => {
                  const selectedValue = currentM[field]
                  return (
                    <div className="mb-5" key={field}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">{italianLabel}</span>
                        <span className="text-sm font-bold text-granata">
                          {selectedValue !== '' && selectedValue != null ? selectedValue : '—'}
                        </span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                          <button
                            key={n}
                            onClick={() =>
                              handleChange(currentPlayer.id, field, Number(selectedValue) === n ? '' : n)
                            }
                            className={`num-btn h-10 w-full rounded-lg text-sm font-semibold transition-all ${getMobileBtnClass(n, selectedValue, targetsMap, field)}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Event mode */
              <div>
                <p className="text-xs text-gray-400 mb-4">
                  Inserisci i conteggi osservati. Il punteggio 1–10 viene calcolato automaticamente.
                </p>
                {PARAMS.map(({ field }) =>
                  field === 'scanning_rate' ? (
                    <SRMultiRowInput
                      key="sr"
                      playerId={currentPlayer.id}
                      rows={srRows[currentPlayer.id] ?? []}
                      onAdd={() => addSRRow(currentPlayer.id)}
                      onUpdate={(i, k, v) => updateSRRow(currentPlayer.id, i, k, v)}
                      onDelete={(i) => deleteSRRow(currentPlayer.id, i)}
                      targetsMap={targetsMap}
                    />
                  ) : (
                    <EventParamRow key={field} field={field} playerId={currentPlayer.id} eventData={eventData} targetsMap={targetsMap} onEventChange={handleEventChange} onEventSet={handleEventSet} />
                  )
                )}
              </div>
            )}

            {!currentM.is_absent && (
              <div className="mt-4">
                <label className="text-xs text-gray-500 mb-1 block">Note giocatore</label>
                <textarea
                  value={currentM.notes ?? ''}
                  onChange={(e) => handleChange(currentPlayer.id, 'notes', e.target.value)}
                  placeholder="Osservazioni facoltative…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
                />
              </div>
            )}
          </div>
        ) : (
          !total && (
            <div className="text-center text-gray-400 py-8 text-sm">Nessun giocatore nel gruppo</div>
          )
        )}

        {/* Sticky bottom nav */}
        <div
          className="fixed left-0 right-0 bg-white border-t border-gray-200 p-3 z-20"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
        >
          {entryMode === 'score' && currentIndex === total - 1 && scoreEmptyCount > 0 && (
            <div className="text-xs text-amber-600 text-center mb-2">
              ⚠ {scoreEmptyCount} giocator{scoreEmptyCount === 1 ? 'e' : 'i'} senza punteggi
            </div>
          )}
          {entryMode === 'event' && currentIndex === total - 1 && insufficientGateCount > 0 && (
            <div className="text-xs text-red-600 text-center mb-2">
              🚫 {insufficientGateCount} giocator{insufficientGateCount === 1 ? 'e' : 'i'} con dati insufficienti — salvataggio bloccato
            </div>
          )}
          {entryMode === 'event' && currentIndex === total - 1 && insufficientGateCount === 0 && insufficientCount > 0 && (
            <div className="text-xs text-amber-600 text-center mb-2">
              ⚠ {insufficientCount} giocator{insufficientCount === 1 ? 'e' : 'i'} con dati sotto soglia
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 disabled:opacity-30 text-sm font-medium"
            >
              ← Precedente
            </button>
            {currentIndex < total - 1 ? (
              <button
                onClick={goToNext}
                className="flex-[2] py-3 px-4 rounded-xl bg-granata text-white text-sm font-semibold"
              >
                Prossimo →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !total || (entryMode === 'event' && insufficientGateCount > 0)}
                className="flex-[2] py-3 px-4 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Salvataggio...' : '✓ Salva sessione'}
              </button>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block pb-28">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <button
            onClick={() => navigate('/sessions')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-1"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{formatDateLong(session.session_date)}</h1>
            <div className="text-sm text-gray-500 mt-0.5">
              {session.session_type}
              {session.duration_min && ` · ${session.duration_min} min`}
            </div>
          </div>
        </div>

        {/* Report link — desktop */}
        <div className="flex justify-end mb-4 -mt-2">
          <button
            onClick={() => navigate(`/reports/session/${id}`)}
            className="text-sm font-bold text-granata border border-granata/30 rounded-lg px-3 py-1.5 hover:bg-granata/5 transition-colors"
          >
            Report sessione →
          </button>
        </div>

        {/* Section tabs — desktop */}
        <div className="flex border-b border-gray-200 mb-5">
          {[
            { key: 'presenze', label: 'Presenze' },
            { key: 'cognitivo', label: 'Cognitivo' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                section === key
                  ? 'border-granata text-granata'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {section === 'presenze' && (
          <AttendanceTab sessionId={id!} players={players} />
        )}

        {section === 'cognitivo' && (
          <>
        {/* Mode toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
          {[['score', 'Punteggio diretto'], ['event', 'Conteggio eventi']].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setEntryMode(mode as 'score' | 'event')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                entryMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{error}</div>
        )}
        {mixedVersionWarning && (
          <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-lg mb-4 border border-amber-200">
            Attenzione: questa sessione contiene dati raccolti con versioni diverse del codebook. I parametri potrebbero non essere direttamente confrontabili.
          </div>
        )}

        {/* Note sessione — desktop */}
        <div className="mb-5">
          <NotesBlock
            notes={session.notes}
            editing={editingNotes}
            value={notesValue}
            saving={savingNotes}
            onChange={setNotesValue}
            onEdit={() => setEditingNotes(true)}
            onSave={handleSaveNotes}
            onCancel={() => { setEditingNotes(false); setNotesValue(session.notes ?? '') }}
          />
        </div>

        {entryMode === 'event' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-xs text-blue-700">
            <strong>Modalità conteggio eventi</strong> — inserisci i conteggi osservati (numeratore / denominatore) per ogni metrica.
            Il punteggio 1–10 viene derivato automaticamente e scritto nelle misurazioni. Il badge indica l'affidabilità statistica del dato.
          </div>
        )}

        {entryMode === 'score' && (
          /* Score-mode legend */
          <div className="flex gap-3 mb-5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> Insuff.
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" /> In crescita
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Ottimo
            </span>
          </div>
        )}

        {/* Players */}
        <div className="space-y-4">
          {players.map((p) => {
            const m = measurements[p.id]
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border p-4 transition-opacity ${m.is_absent ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}
              >
                {/* Player header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{p.last_name} {p.first_name}</span>
                  <div className="flex items-center gap-2 select-none">
                    {entryMode === 'event' && !m.is_absent && hasAnyEventData(p.id) && (
                      <ReliabilityChip ok={getReliabilityOkCount(p.id)} total={PARAMS.length} />
                    )}
                    {entryMode === 'score' && !m.is_absent && (
                      <ScoreCompletenessChip filled={getScoreFilledCount(p.id)} total={PARAMS.length} />
                    )}
                    <span className="text-sm text-gray-500">Assente</span>
                    <ToggleSwitch checked={m.is_absent} onChange={() => toggleAbsent(p.id)} size="sm" />
                  </div>
                </div>

                {!m.is_absent && entryMode === 'score' && (
                  <div className="grid grid-cols-5 gap-2">
                    {PARAMS.map(({ label, field }) => (
                      <div key={field} className="text-center">
                        <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
                        <input
                          type="number"
                          min="1" max="10" step="1"
                          value={m[field] !== '' && m[field] != null ? Math.round(Number(m[field])) : ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw === '') { handleChange(p.id, field, null); return }
                            const num = parseInt(raw, 10)
                            if (!isNaN(num) && num >= 1 && num <= 10) handleChange(p.id, field, num)
                          }}
                          onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault() }}
                          disabled={m.is_absent}
                          className={`w-full text-center border rounded-lg text-sm font-semibold min-h-12 focus:outline-none focus:ring-2 focus:ring-granata disabled:cursor-not-allowed transition-colors ${
                            m.is_absent ? 'bg-gray-50 border-gray-200 text-gray-300' : valueBadgeClass(m[field], targetsMap, field)
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {!m.is_absent && entryMode === 'event' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {PARAMS.map(({ field }) =>
                      field === 'scanning_rate' ? (
                        <div key="sr" className="lg:col-span-2">
                          <SRMultiRowInput
                            playerId={p.id}
                            rows={srRows[p.id] ?? []}
                            onAdd={() => addSRRow(p.id)}
                            onUpdate={(i, k, v) => updateSRRow(p.id, i, k, v)}
                            onDelete={(i) => deleteSRRow(p.id, i)}
                            targetsMap={targetsMap}
                          />
                        </div>
                      ) : (
                        <EventParamRow key={field} field={field} playerId={p.id} compact eventData={eventData} targetsMap={targetsMap} onEventChange={handleEventChange} onEventSet={handleEventSet} />
                      )
                    )}
                  </div>
                )}

                {!m.is_absent && (
                  <div className="mt-3">
                    <textarea
                      value={m.notes ?? ''}
                      onChange={(e) => handleChange(p.id, 'notes', e.target.value)}
                      placeholder="Note giocatore…"
                      rows={1}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-granata resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {!players.length && (
            <div className="text-center text-gray-400 py-8 text-sm">Nessun giocatore nel gruppo</div>
          )}
        </div>
          </>
        )}

        {/* Sticky save bar — solo tab cognitivo */}
        {section === 'cognitivo' && (
          <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-gray-200 p-4 flex items-center gap-3 z-20">
            {entryMode === 'score' && scoreEmptyCount > 0 && (
              <span className="text-amber-600 text-xs font-medium shrink-0">
                ⚠ {scoreEmptyCount} giocator{scoreEmptyCount === 1 ? 'e' : 'i'} senza punteggi
              </span>
            )}
            {entryMode === 'event' && insufficientGateCount > 0 && (
              <span className="text-red-600 text-xs font-medium shrink-0">
                🚫 {insufficientGateCount} giocator{insufficientGateCount === 1 ? 'e' : 'i'} con dati insufficienti
              </span>
            )}
            {entryMode === 'event' && insufficientGateCount === 0 && insufficientCount > 0 && (
              <span className="text-amber-600 text-xs font-medium shrink-0">
                ⚠ {insufficientCount} giocator{insufficientCount === 1 ? 'e' : 'i'} con dati sotto soglia
              </span>
            )}
            {saveOk && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">✓ Salvato</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !players.length || (entryMode === 'event' && insufficientGateCount > 0)}
              className="flex-1 bg-granata text-white py-3 rounded-xl font-medium text-sm hover:bg-granata-dark transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvataggio…' : 'Salva sessione'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
