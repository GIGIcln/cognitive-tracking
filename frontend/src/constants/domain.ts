export type MetricField =
  | 'scanning_rate'
  | 'decision_quality'
  | 'anticipation'
  | 'transition_reset'
  | 'verbal_comm'

export type MetricType = 'SR' | 'DQI' | 'AI' | 'TRS' | 'VCI'
export type ReliabilityLevel = 'insufficient' | 'low' | 'medium' | 'high'

export interface CognitiveParam {
  field: MetricField
  label: MetricType
  italianLabel: string
  avgKey: string
}

export interface MetricEventConfig {
  metric_type: MetricType
  numerator_label: string
  denominator_label: string
  rate_label: string
  min_n: number | null
  count_only: boolean
}

export interface ReliabilityMeta {
  label: string
  color: string
  bg: string
}

export const LEVEL_COLORS: Record<string, string> = {
  alto: 'bg-green-100 text-green-700',
  medio: 'bg-yellow-100 text-yellow-700',
  basso: 'bg-red-100 text-red-700',
  'medio/alto': 'bg-green-50 text-green-600',
  'medio/basso': 'bg-orange-100 text-orange-700',
}

export const SESSION_TYPES: string[] = ['SSG', 'Partita a tema', 'Partita']

export const POSITIONS: { value: string; label: string }[] = [
  { value: 'POR', label: 'Portiere' },
  { value: 'DIF', label: 'Difensore' },
  { value: 'CEN', label: 'Centrocampista' },
  { value: 'ATT', label: 'Attaccante' },
]

export const FOOT_OPTIONS: { value: string; label: string }[] = [
  { value: 'destro', label: 'Destro' },
  { value: 'sinistro', label: 'Sinistro' },
  { value: 'ambidestro', label: 'Ambidestro' },
]

export const GROUP_CATEGORIES: string[] = ['Esordienti', 'Pulcini', 'Primi Calci']

export const COGNITIVE_PARAMS: CognitiveParam[] = [
  { field: 'scanning_rate',    label: 'SR',  italianLabel: 'Scanning Rate',  avgKey: 'avg_sr'  },
  { field: 'decision_quality', label: 'DQI', italianLabel: 'Dec. Quality',   avgKey: 'avg_dqi' },
  { field: 'anticipation',     label: 'AI',  italianLabel: 'Anticipazione',  avgKey: 'avg_ai'  },
  { field: 'transition_reset', label: 'TRS', italianLabel: 'Trans. Reset',   avgKey: 'avg_trs' },
  { field: 'verbal_comm',      label: 'VCI', italianLabel: 'Comunicazione',  avgKey: 'avg_vci' },
]

export const METRIC_EVENT_CONFIG: Record<MetricField, MetricEventConfig> = {
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

export const FIELD_TO_METRIC = Object.fromEntries(
  COGNITIVE_PARAMS.map(({ field, label }) => [field, label])
) as Record<MetricField, MetricType>

export const RELIABILITY_META: Record<ReliabilityLevel, ReliabilityMeta> = {
  insufficient: { label: 'Dati insufficienti', color: 'text-red-500',    bg: 'bg-red-50'    },
  low:          { label: 'Affid. bassa',        color: 'text-orange-500', bg: 'bg-orange-50' },
  medium:       { label: 'Affid. media',        color: 'text-yellow-600', bg: 'bg-yellow-50' },
  high:         { label: 'Affid. alta',         color: 'text-green-600',  bg: 'bg-green-50'  },
}

export function deriveScore(
  metricType: MetricType,
  numerator: number,
  denominator: number,
): number | null {
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

export function deriveReliability(
  metricType: MetricType,
  numerator: number,
  denominator: number,
): ReliabilityLevel {
  if (metricType === 'AI') {
    if (numerator < 3)  return 'insufficient'
    if (numerator < 6)  return 'low'
    if (numerator < 10) return 'medium'
    return 'high'
  }
  const field = (Object.keys(METRIC_EVENT_CONFIG) as MetricField[]).find(
    (k) => METRIC_EVENT_CONFIG[k].metric_type === metricType,
  )
  const minN = field ? METRIC_EVENT_CONFIG[field].min_n : null
  if (minN === null) return 'insufficient'
  const half = Math.floor(minN / 2)
  if (denominator < half)     return 'insufficient'
  if (denominator < minN)     return 'low'
  if (denominator < minN * 2) return 'medium'
  return 'high'
}
