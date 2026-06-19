export async function exportReportPDF(contentId, filename) {
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')

  const exportButtons = document.getElementById('export-buttons')
  const backBtn = document.getElementById('report-back-btn')
  if (exportButtons) exportButtons.style.display = 'none'
  if (backBtn) backBtn.style.display = 'none'

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 8
  const contentWidth = pdfWidth - margin * 2
  let currentY = margin

  document.querySelectorAll(`#${contentId} [class*="overflow-x"]`).forEach((el) => { el.scrollLeft = 0 })

  const sections = Array.from(document.querySelectorAll(`#${contentId} .report-section`))
  for (let idx = 0; idx < sections.length; idx++) {
    const canvas = await html2canvas(sections[idx], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: 1200,
      scrollX: 0,
      scrollY: -window.scrollY,
    })
    const imgData = canvas.toDataURL('image/png')
    const imgH = (canvas.height * contentWidth) / canvas.width

    if (currentY > margin && currentY + imgH > pdfHeight - margin) {
      pdf.addPage()
      currentY = margin
    }

    pdf.addImage(imgData, 'PNG', margin, currentY, contentWidth, imgH)
    currentY += imgH + 3

    const isLast = idx === sections.length - 1
    if (!isLast && currentY > pdfHeight - margin - 8) {
      pdf.addPage()
      currentY = margin
    }
  }

  if (exportButtons) exportButtons.style.display = ''
  if (backBtn) backBtn.style.display = ''
  pdf.save(filename)
}

export function exportPlayerCSV(playerName, history, targets) {
  const params = [
    { key: 'scanning_rate',    label: 'Scanning Rate',  code: 'SR'  },
    { key: 'decision_quality', label: 'Decision Quality', code: 'DQI' },
    { key: 'anticipation',     label: 'Anticipazione',  code: 'AI'  },
    { key: 'transition_reset', label: 'Trans. Reset',   code: 'TRS' },
    { key: 'verbal_comm',      label: 'Comunicazione',  code: 'VCI' },
  ]

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
