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
