import type { MetricType } from '../constants/domain'

export interface GroupTarget {
  parameter: MetricType
  ottimo_min: number
  insufficient_max: number
}

export interface LinearRegressionResult {
  slope: number
  intercept: number
}

export const LINE_COLORS: string[] = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

export function linearRegression(xs: number[], ys: number[]): LinearRegressionResult | null {
  const n = xs.length
  if (n < 2) return null
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export function badge(
  val: number | null | undefined,
  target: GroupTarget | null | undefined,
): '🟢' | '🔴' | '🟡' | null {
  if (val == null || !target) return null
  if (val >= target.ottimo_min) return '🟢'
  if (val <= target.insufficient_max) return '🔴'
  return '🟡'
}

export function generateComment(
  subject: string,
  lastData: Record<string, number | null | undefined>,
  targets: GroupTarget[],
  history: Record<string, number | null | undefined>[],
  fieldKeys: string[],
): string {
  const labels: MetricType[] = ['SR', 'DQI', 'AI', 'TRS', 'VCI']
  const italianLabels: string[] = [
    'Scanning Rate', 'Decision Quality', 'Anticipazione',
    'Transition Reset', 'Comunicazione Verbale',
  ]

  const strong: string[] = []
  const weak: string[] = []
  const sufficient: string[] = []

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
    const avgPrev = fieldKeys.reduce((s, k) => s + (prev[k] ?? 0), 0) / fieldKeys.length
    const avgCurr = fieldKeys.reduce((s, k) => s + (curr[k] ?? 0), 0) / fieldKeys.length
    const diff = (avgCurr - avgPrev).toFixed(1)
    if (Number(diff) > 0) trendText = `Trend generale in miglioramento (+${diff} punti medi).`
    else if (Number(diff) < 0) trendText = `Trend generale in calo (${diff} punti medi).`
    else trendText = `Trend generale stabile.`
  }

  let comment = `${subject}: `
  if (strong.length) comment += `Ottimo su ${strong.join(', ')}. `
  if (sufficient.length) comment += `Sufficiente su ${sufficient.join(', ')}. `
  if (weak.length) comment += `Insufficiente su ${weak.join(', ')} — area prioritaria. `
  if (trendText) comment += trendText
  return comment
}
