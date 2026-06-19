import { describe, it, expect } from 'vitest'
import { linearRegression, badge, generateComment } from '../utils/reportUtils'

// ── linearRegression ──────────────────────────────────────────────────────────

describe('linearRegression', () => {
  it('array vuoto → null', () => {
    expect(linearRegression([], [])).toBeNull()
  })

  it('un solo punto → null', () => {
    expect(linearRegression([1], [2])).toBeNull()
  })

  it('tutti gli x identici (denominatore=0) → null', () => {
    expect(linearRegression([1, 1, 1], [3, 4, 5])).toBeNull()
  })

  it('y=x → slope=1, intercept=0', () => {
    const r = linearRegression([0, 1, 2, 3], [0, 1, 2, 3])
    expect(r.slope).toBeCloseTo(1)
    expect(r.intercept).toBeCloseTo(0)
  })

  it('trend decrescente', () => {
    const r = linearRegression([0, 1, 2], [6, 4, 2])
    expect(r.slope).toBeCloseTo(-2)
    expect(r.intercept).toBeCloseTo(6)
  })

  it('serie piatta → slope≈0', () => {
    const r = linearRegression([0, 1, 2, 3], [5, 5, 5, 5])
    expect(r.slope).toBeCloseTo(0)
    expect(r.intercept).toBeCloseTo(5)
  })
})

// ── badge ─────────────────────────────────────────────────────────────────────

describe('badge', () => {
  const target = { ottimo_min: 8, insufficient_max: 4 }

  it('valore null → null', () => expect(badge(null, target)).toBeNull())
  it('target assente → null', () => expect(badge(7, null)).toBeNull())
  it('valore ≥ ottimo_min → 🟢', () => expect(badge(9, target)).toBe('🟢'))
  it('valore = ottimo_min → 🟢 (boundary inclusivo)', () => expect(badge(8, target)).toBe('🟢'))
  it('valore ≤ insufficient_max → 🔴', () => expect(badge(3, target)).toBe('🔴'))
  it('valore = insufficient_max → 🔴 (boundary inclusivo)', () => expect(badge(4, target)).toBe('🔴'))
  it('valore tra le soglie → 🟡', () => expect(badge(6, target)).toBe('🟡'))
})

// ── generateComment ───────────────────────────────────────────────────────────

describe('generateComment', () => {
  const fieldKeys = ['scanning_rate', 'decision_quality', 'anticipation', 'transition_reset', 'verbal_comm']
  const targets = [
    { parameter: 'SR',  ottimo_min: 8, insufficient_max: 4 },
    { parameter: 'DQI', ottimo_min: 8, insufficient_max: 4 },
    { parameter: 'AI',  ottimo_min: 8, insufficient_max: 4 },
    { parameter: 'TRS', ottimo_min: 8, insufficient_max: 4 },
    { parameter: 'VCI', ottimo_min: 8, insufficient_max: 4 },
  ]

  const allGood = { scanning_rate: 9, decision_quality: 9, anticipation: 9, transition_reset: 9, verbal_comm: 9 }
  const allBad  = { scanning_rate: 2, decision_quality: 2, anticipation: 2, transition_reset: 2, verbal_comm: 2 }
  const mixed   = { scanning_rate: 9, decision_quality: 6, anticipation: 2, transition_reset: 9, verbal_comm: 6 }

  it('include il soggetto nel commento', () => {
    const c = generateComment('Mario Rossi', allGood, targets, [allGood], fieldKeys)
    expect(c).toContain('Mario Rossi')
  })

  it('ottima performance → contiene "Ottimo"', () => {
    const c = generateComment('Mario', allGood, targets, [allGood], fieldKeys)
    expect(c).toContain('Ottimo')
  })

  it('performance insufficiente → contiene "area prioritaria"', () => {
    const c = generateComment('Mario', allBad, targets, [allBad], fieldKeys)
    expect(c).toContain('area prioritaria')
  })

  it('performance mista → contiene sia "Ottimo" che "area prioritaria"', () => {
    const c = generateComment('Mario', mixed, targets, [mixed], fieldKeys)
    expect(c).toContain('Ottimo')
    expect(c).toContain('area prioritaria')
  })

  it('trend crescente → contiene "miglioramento"', () => {
    const sess1 = { scanning_rate: 5, decision_quality: 5, anticipation: 5, transition_reset: 5, verbal_comm: 5 }
    const sess2 = { scanning_rate: 7, decision_quality: 7, anticipation: 7, transition_reset: 7, verbal_comm: 7 }
    const c = generateComment('Mario', sess2, targets, [sess1, sess2], fieldKeys)
    expect(c).toContain('miglioramento')
  })

  it('trend in calo → contiene "calo"', () => {
    const sess1 = { scanning_rate: 7, decision_quality: 7, anticipation: 7, transition_reset: 7, verbal_comm: 7 }
    const sess2 = { scanning_rate: 5, decision_quality: 5, anticipation: 5, transition_reset: 5, verbal_comm: 5 }
    const c = generateComment('Mario', sess2, targets, [sess1, sess2], fieldKeys)
    expect(c).toContain('calo')
  })

  it('trend stabile → contiene "stabile"', () => {
    const sess = { scanning_rate: 6, decision_quality: 6, anticipation: 6, transition_reset: 6, verbal_comm: 6 }
    const c = generateComment('Mario', sess, targets, [sess, { ...sess }], fieldKeys)
    expect(c).toContain('stabile')
  })

  it('una sola sessione → nessun testo di trend', () => {
    const c = generateComment('Mario', allGood, targets, [allGood], fieldKeys)
    expect(c).not.toContain('Trend')
  })
})
