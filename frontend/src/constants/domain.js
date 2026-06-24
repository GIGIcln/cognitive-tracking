export const LEVEL_COLORS = {
  alto: 'bg-green-100 text-green-700',
  medio: 'bg-yellow-100 text-yellow-700',
  basso: 'bg-red-100 text-red-700',
  'medio/alto': 'bg-green-50 text-green-600',
  'medio/basso': 'bg-orange-100 text-orange-700',
}

export const SESSION_TYPES = ['SSG', 'Partita a tema', 'Partita']

export const POSITIONS = [
  { value: 'POR', label: 'Portiere' },
  { value: 'DIF', label: 'Difensore' },
  { value: 'CEN', label: 'Centrocampista' },
  { value: 'ATT', label: 'Attaccante' },
]

export const GROUP_CATEGORIES = ['Esordienti', 'Pulcini', 'Primi Calci']

export const COGNITIVE_PARAMS = [
  { field: 'scanning_rate',    label: 'SR',  italianLabel: 'Scanning Rate',  avgKey: 'avg_sr'  },
  { field: 'decision_quality', label: 'DQI', italianLabel: 'Dec. Quality',   avgKey: 'avg_dqi' },
  { field: 'anticipation',     label: 'AI',  italianLabel: 'Anticipazione',  avgKey: 'avg_ai'  },
  { field: 'transition_reset', label: 'TRS', italianLabel: 'Trans. Reset',   avgKey: 'avg_trs' },
  { field: 'verbal_comm',      label: 'VCI', italianLabel: 'Comunicazione',  avgKey: 'avg_vci' },
]

// Configuration for event-based entry mode.
// numerator_label / denominator_label describe what the coach is counting.
// min_n is the denominator threshold for "reliable" data (null = AI uses numerator).
// count_only = true means denominator is always 1 (AI: just count moves, no rate).
export const METRIC_EVENT_CONFIG = {
  scanning_rate: {
    metric_type:       'SR',
    numerator_label:   'Check pre-tocco',
    denominator_label: 'Ricezioni in pressione',
    rate_label:        'SR%',
    min_n:             15,
    count_only:        false,
  },
  decision_quality: {
    metric_type:       'DQI',
    numerator_label:   'Decisioni corrette',
    denominator_label: 'Decision points',
    rate_label:        'DQI%',
    min_n:             20,
    count_only:        false,
  },
  anticipation: {
    metric_type:       'AI',
    numerator_label:   'Movimenti anticipatori',
    denominator_label: '— (non usato)',
    rate_label:        'conteggio',
    min_n:             null,
    count_only:        true,
  },
  transition_reset: {
    metric_type:       'TRS',
    numerator_label:   'Reset nei tempi',
    denominator_label: 'Transizioni osservate',
    rate_label:        'TRS%',
    min_n:             10,
    count_only:        false,
  },
  verbal_comm: {
    metric_type:       'VCI',
    numerator_label:   'Comunicazioni rilevanti',
    denominator_label: 'Minuti osservati',
    rate_label:        'eventi/min',
    min_n:             8,
    count_only:        false,
  },
}

// Derived from COGNITIVE_PARAMS: maps Measurement field name → metric type string.
export const FIELD_TO_METRIC = Object.fromEntries(
  COGNITIVE_PARAMS.map(({ field, label }) => [field, label])
)

export const RELIABILITY_META = {
  insufficient: { label: 'Dati insufficienti', color: 'text-red-500',    bg: 'bg-red-50'    },
  low:          { label: 'Affid. bassa',        color: 'text-orange-500', bg: 'bg-orange-50' },
  medium:       { label: 'Affid. media',        color: 'text-yellow-600', bg: 'bg-yellow-50' },
  high:         { label: 'Affid. alta',         color: 'text-green-600',  bg: 'bg-green-50'  },
}

// Derives a 1–10 score from raw event counts — mirrors backend observation_service.py.
export function deriveScore(metricType, numerator, denominator) {
  if (metricType === 'SR' || metricType === 'DQI' || metricType === 'TRS') {
    if (denominator === 0) return null
    const rate = numerator / denominator
    return Math.round(Math.min(10, Math.max(1, 1 + rate * 9)) * 10) / 10
  }
  if (metricType === 'AI') {
    if (numerator === 0) return 1.0
    return Math.round(Math.min(10, Math.max(1, 1 + numerator * 0.9)) * 10) / 10
  }
  if (metricType === 'VCI') {
    if (denominator === 0) return null
    const ratePerMin = numerator / denominator
    return Math.round(Math.min(10, Math.max(1, 1 + (ratePerMin / 2) * 9)) * 10) / 10
  }
  return null
}

export function deriveReliability(metricType, numerator, denominator) {
  const minN = METRIC_EVENT_CONFIG[
    Object.keys(METRIC_EVENT_CONFIG).find(
      (k) => METRIC_EVENT_CONFIG[k].metric_type === metricType
    )
  ]?.min_n ?? null

  if (metricType === 'AI') {
    if (numerator < 3)  return 'insufficient'
    if (numerator < 6)  return 'low'
    if (numerator < 10) return 'medium'
    return 'high'
  }
  const half = Math.floor(minN / 2)
  if (denominator < half)      return 'insufficient'
  if (denominator < minN)      return 'low'
  if (denominator < minN * 2)  return 'medium'
  return 'high'
}
