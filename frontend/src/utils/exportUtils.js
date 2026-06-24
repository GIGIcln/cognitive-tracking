import api from '../api/axios'
import { COGNITIVE_PARAMS } from '../constants/domain'

export async function exportReportPDF(apiPath, filename) {
  const response = await api.get(apiPath, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPlayerCSV(playerName, history, targets) {
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
    const row = [
      new Date(s.session_date).toLocaleDateString('it-IT'),
      s.session_type,
      s.group_name,
    ]
    params.forEach((p) => {
      const val = s[p.key] !== null ? s[p.key] : ''
      const t = targets.find((t) => t.parameter === p.code)
      const targetStr = t ? `<=${t.insufficient_max}/>=${t.ottimo_min}` : ''
      row.push(val, targetStr)
    })
    return row
  })

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_${playerName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportSessionTeamCSV(session, groupName, playerRankings, averages, targets) {
  const paramLabels = {
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

  const avgRow = averages
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

  const sections = [
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

  const csvContent = sections
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_sessione_${groupName.replace(/\s/g, '_')}_${session?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportSessionPlayerCSV(playerLastName, playerFirstName, session, groupName, measurement, averages, targets) {
  const params = COGNITIVE_PARAMS.map((p) => ({ key: p.field, avgKey: p.avgKey, label: p.italianLabel, code: p.label }))

  const sessionDate = session?.session_date ? new Date(session.session_date).toLocaleDateString('it-IT') : ''

  const headers = ['Parametro', 'Giocatore', 'Media squadra', 'Max Insufficiente', 'Min Ottimo']
  const rows = params.map((p) => {
    const t = targets.find((t) => t.parameter === p.code)
    return [
      p.label,
      measurement?.[p.key]?.toFixed(1) ?? '',
      averages?.[p.avgKey]?.toFixed(1) ?? '',
      t?.insufficient_max ?? '',
      t?.ottimo_min ?? '',
    ]
  })

  const sections = [
    [`REPORT SESSIONE — ${playerLastName} ${playerFirstName}`],
    [`Data: ${sessionDate}  Tipo: ${session?.session_type ?? ''}  Gruppo: ${groupName}`],
    [`Generato il: ${new Date().toLocaleDateString('it-IT')}`],
    [],
    headers,
    ...rows,
  ]

  const csvContent = sections
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_sessione_${playerLastName}_${playerFirstName}_${session?.session_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportTeamCSV(groupName, history, rankings, targets) {
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
  const paramLabels = {
    SR: 'Scanning Rate', DQI: 'Decision Quality',
    AI: 'Anticipazione', TRS: 'Trans. Reset', VCI: 'Comunicazione',
  }
  const targetRows = targets.map((t) => [
    paramLabels[t.parameter] ?? t.parameter,
    t.insufficient_max,
    t.ottimo_min,
  ])

  const sections = [
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

  const csvContent = sections
    .map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_squadra_${groupName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
