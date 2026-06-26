import api from '../api/axios'
import { COGNITIVE_PARAMS } from '../constants/domain'
import type { GroupTarget } from './reportUtils'

interface PlayerHistoryEntry {
  session_date: string
  session_type: string
  group_name: string
  [key: string]: unknown
}

interface PlayerRankingEntry {
  last_name: string
  first_name: string
  scanning_rate?: number | null
  decision_quality?: number | null
  anticipation?: number | null
  transition_reset?: number | null
  verbal_comm?: number | null
  avg?: number | null
}

interface SessionAverages {
  avg_sr?: number | null
  avg_dqi?: number | null
  avg_ai?: number | null
  avg_trs?: number | null
  avg_vci?: number | null
  player_count?: number | null
  [key: string]: unknown
}

interface SessionInfo {
  session_date?: string | null
  session_type?: string | null
  duration_min?: number | null
}

interface MeasurementEntry {
  [key: string]: unknown
}

interface TeamHistoryEntry {
  session_date: string
  session_type: string
  player_count?: number | null
  avg_sr?: number | null
  avg_dqi?: number | null
  avg_ai?: number | null
  avg_trs?: number | null
  avg_vci?: number | null
}

function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvRows(sections: (string | number | null | undefined)[][]): string {
  return sections
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export async function exportReportPDF(apiPath: string, filename: string): Promise<void> {
  const response = await api.get(apiPath, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPlayerCSV(
  playerName: string,
  history: PlayerHistoryEntry[],
  targets: GroupTarget[],
): void {
  const params = COGNITIVE_PARAMS.map((p) => ({ key: p.field, label: p.italianLabel, code: p.label }))

  const headers = [
    'Data', 'Tipo sessione', 'Gruppo',
    'Scanning Rate', 'Target SR (insuff/ottimo)',
    'Decision Quality', 'Target DQI (insuff/ottimo)',
    'Anticipazione', 'Target AI (insuff/ottimo)',
    'Trans. Reset', 'Target TRS (insuff/ottimo)',
    'Comunicazione', 'Target VCI (insuff/ottimo)',
  ]

  const rows = history.map((s) => {
    const row: (string | number | null)[] = [
      new Date(s.session_date).toLocaleDateString('it-IT'),
      s.session_type,
      s.group_name,
    ]
    params.forEach((p) => {
      const val = (s[p.key] !== null && s[p.key] !== undefined) ? (s[p.key] as string | number) : ''
      const t = targets.find((t) => t.parameter === p.code)
      const targetStr = t ? `<=${t.insufficient_max}/>=${t.ottimo_min}` : ''
      row.push(val as string | number, targetStr)
    })
    return row
  })

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')

  downloadCSV(csvContent, `report_${playerName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
}

export function exportSessionTeamCSV(
  session: SessionInfo | null | undefined,
  groupName: string,
  playerRankings: (PlayerRankingEntry & { avg?: number | null })[],
  averages: SessionAverages | null | undefined,
  targets: GroupTarget[],
): void {
  const paramLabels: Record<string, string> = {
    SR: 'Scanning Rate', DQI: 'Decision Quality',
    AI: 'Anticipazione', TRS: 'Trans. Reset', VCI: 'Comunicazione',
  }

  const sessionDate = session?.session_date ? new Date(session.session_date).toLocaleDateString('it-IT') : ''

  const rankHeaders = ['Pos.', 'Giocatore', 'SR', 'DQI', 'AI', 'TRS', 'VCI', 'Media']
  const rankRows = playerRankings.map((p, i) => [
    i + 1,
    `${p.last_name} ${p.first_name}`,
    p.scanning_rate?.toFixed(1) ?? '',
    p.decision_quality?.toFixed(1) ?? '',
    p.anticipation?.toFixed(1) ?? '',
    p.transition_reset?.toFixed(1) ?? '',
    p.verbal_comm?.toFixed(1) ?? '',
    p.avg?.toFixed(1) ?? '',
  ])

  const avgRow: (string | number)[] | null = averages
    ? ['', 'MEDIA SQUADRA',
        averages.avg_sr?.toFixed(1) ?? '',
        averages.avg_dqi?.toFixed(1) ?? '',
        averages.avg_ai?.toFixed(1) ?? '',
        averages.avg_trs?.toFixed(1) ?? '',
        averages.avg_vci?.toFixed(1) ?? '',
        '',
      ]
    : null

  const targetHeaders = ['Parametro', 'Max Insufficiente', 'Min Ottimo']
  const targetRows = targets.map((t) => [paramLabels[t.parameter] ?? t.parameter, t.insufficient_max, t.ottimo_min])

  const sections: (string | number | null | undefined)[][] = [
    [`REPORT SESSIONE — ${groupName}`],
    [`Data: ${sessionDate}  Tipo: ${session?.session_type ?? ''}  Giocatori: ${averages?.player_count ?? ''}`],
    [`Generato il: ${new Date().toLocaleDateString('it-IT')}`],
    [],
    ['--- CLASSIFICA GIOCATORI ---'],
    rankHeaders,
    ...rankRows,
    ...(avgRow ? [avgRow] : []),
    [],
    ['--- VALORI TARGET ---'],
    targetHeaders,
    ...targetRows,
  ]

  downloadCSV(
    csvRows(sections),
    `report_sessione_${groupName.replace(/\s/g, '_')}_${session?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}.csv`
  )
}

export function exportSessionPlayerCSV(
  playerLastName: string,
  playerFirstName: string,
  session: SessionInfo | null | undefined,
  groupName: string,
  measurement: MeasurementEntry | null | undefined,
  averages: SessionAverages | null | undefined,
  targets: GroupTarget[],
): void {
  const params = COGNITIVE_PARAMS.map((p) => ({ key: p.field, avgKey: p.avgKey, label: p.italianLabel, code: p.label }))

  const sessionDate = session?.session_date ? new Date(session.session_date).toLocaleDateString('it-IT') : ''

  const headers = ['Parametro', 'Giocatore', 'Media squadra', 'Max Insufficiente', 'Min Ottimo']
  const rows = params.map((p) => {
    const t = targets.find((t) => t.parameter === p.code)
    const mVal = measurement?.[p.key] as number | null | undefined
    const aVal = averages?.[p.avgKey] as number | null | undefined
    return [
      p.label,
      mVal?.toFixed(1) ?? '',
      aVal?.toFixed(1) ?? '',
      t?.insufficient_max ?? '',
      t?.ottimo_min ?? '',
    ]
  })

  const sections: (string | number | null | undefined)[][] = [
    [`REPORT SESSIONE — ${playerLastName} ${playerFirstName}`],
    [`Data: ${sessionDate}  Tipo: ${session?.session_type ?? ''}  Gruppo: ${groupName}`],
    [`Generato il: ${new Date().toLocaleDateString('it-IT')}`],
    [],
    headers,
    ...rows,
  ]

  downloadCSV(
    csvRows(sections),
    `report_sessione_${playerLastName}_${playerFirstName}_${session?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}.csv`
  )
}

export function exportTeamCSV(
  groupName: string,
  history: TeamHistoryEntry[],
  rankings: (PlayerRankingEntry & { avg?: number | null })[],
  targets: GroupTarget[],
): void {
  const historyHeaders = [
    'Data', 'Tipo sessione', 'N. giocatori',
    'Media SR', 'Media DQI', 'Media AI', 'Media TRS', 'Media VCI',
  ]
  const historyRows = history.map((s) => [
    new Date(s.session_date).toLocaleDateString('it-IT'),
    s.session_type,
    s.player_count,
    s.avg_sr?.toFixed(1) ?? '',
    s.avg_dqi?.toFixed(1) ?? '',
    s.avg_ai?.toFixed(1) ?? '',
    s.avg_trs?.toFixed(1) ?? '',
    s.avg_vci?.toFixed(1) ?? '',
  ])

  const rankHeaders = ['Pos.', 'Giocatore', 'SR', 'DQI', 'AI', 'TRS', 'VCI', 'Media']
  const rankRows = rankings.map((p, i) => [
    i + 1,
    `${p.last_name} ${p.first_name}`,
    p.scanning_rate ?? '',
    p.decision_quality ?? '',
    p.anticipation ?? '',
    p.transition_reset ?? '',
    p.verbal_comm ?? '',
    p.avg?.toFixed(1) ?? '',
  ])

  const targetHeaders = ['Parametro', 'Max Insufficiente', 'Min Ottimo']
  const paramLabels: Record<string, string> = {
    SR: 'Scanning Rate', DQI: 'Decision Quality',
    AI: 'Anticipazione', TRS: 'Trans. Reset', VCI: 'Comunicazione',
  }
  const targetRows = targets.map((t) => [
    paramLabels[t.parameter] ?? t.parameter,
    t.insufficient_max,
    t.ottimo_min,
  ])

  const sections: (string | number | null | undefined)[][] = [
    [`REPORT SQUADRA: ${groupName}`],
    [`Generato il: ${new Date().toLocaleDateString('it-IT')}`],
    [],
    ['--- STORICO MEDIE SQUADRA ---'],
    historyHeaders,
    ...historyRows,
    [],
    ['--- CLASSIFICA GIOCATORI (ultima sessione) ---'],
    rankHeaders,
    ...rankRows,
    [],
    ['--- VALORI TARGET ---'],
    targetHeaders,
    ...targetRows,
  ]

  downloadCSV(
    csvRows(sections),
    `report_squadra_${groupName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
  )
}
