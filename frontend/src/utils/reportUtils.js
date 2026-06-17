export const LINE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

export function badge(val, target) {
  if (val == null || !target) return null
  if (val >= target.ottimo_min) return '🟢'
  if (val <= target.insufficient_max) return '🔴'
  return '🟡'
}

/**
 * Genera un commento testuale basato sull'ultima sessione rispetto ai target.
 * @param {string} subject  - Soggetto del commento (es. nome giocatore o "La squadra")
 * @param {object} lastData - Ultimo record (sessione giocatore o media squadra)
 * @param {Array}  targets  - Array di GroupTarget con parameter, ottimo_min, insufficient_max
 * @param {Array}  history  - Storico completo per calcolo trend
 * @param {Array}  fieldKeys - Chiavi da leggere in lastData/history (ordinate come SR,DQI,AI,TRS,VCI)
 */
export function generateComment(subject, lastData, targets, history, fieldKeys) {
  const labels = ['SR', 'DQI', 'AI', 'TRS', 'VCI']
  const italianLabels = [
    'Scanning Rate', 'Decision Quality', 'Anticipazione',
    'Transition Reset', 'Comunicazione Verbale',
  ]

  const strong = [], weak = [], sufficient = []
  fieldKeys.forEach((key, i) => {
    const val = lastData[key]
    const t = targets.find((t) => t.parameter === labels[i])
    if (!val || !t) return
    if (val >= t.ottimo_min) strong.push(italianLabels[i])
    else if (val <= t.insufficient_max) weak.push(italianLabels[i])
    else sufficient.push(italianLabels[i])
  })

  let trendText = ''
  if (history.length >= 2) {
    const prev = history[history.length - 2]
    const curr = history[history.length - 1]
    const avgPrev = fieldKeys.reduce((s, k) => s + (prev[k] || 0), 0) / fieldKeys.length
    const avgCurr = fieldKeys.reduce((s, k) => s + (curr[k] || 0), 0) / fieldKeys.length
    const diff = (avgCurr - avgPrev).toFixed(1)
    if (diff > 0) trendText = `Trend generale in miglioramento (+${diff} punti medi).`
    else if (diff < 0) trendText = `Trend generale in calo (${diff} punti medi).`
    else trendText = `Trend generale stabile.`
  }

  let comment = `${subject}: `
  if (strong.length) comment += `Ottimo su ${strong.join(', ')}. `
  if (sufficient.length) comment += `Sufficiente su ${sufficient.join(', ')}. `
  if (weak.length) comment += `Insufficiente su ${weak.join(', ')} — area prioritaria. `
  if (trendText) comment += trendText
  return comment
}
