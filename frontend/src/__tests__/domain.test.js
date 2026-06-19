import { describe, it, expect } from 'vitest'
import { deriveScore, deriveReliability, FIELD_TO_METRIC } from '../constants/domain'

// ── deriveScore ───────────────────────────────────────────────────────────────

describe('deriveScore — SR / DQI / TRS (metriche percentuali)', () => {
  it('denominator=0 → null', () => {
    expect(deriveScore('SR',  5, 0)).toBeNull()
    expect(deriveScore('DQI', 5, 0)).toBeNull()
    expect(deriveScore('TRS', 5, 0)).toBeNull()
  })

  it('0% → 1.0 (floor)', () => {
    expect(deriveScore('SR', 0, 10)).toBe(1.0)
  })

  it('50% → 5.5', () => {
    // 1 + 0.5 * 9 = 5.5
    expect(deriveScore('SR', 5, 10)).toBe(5.5)
  })

  it('100% → 10.0 (ceiling)', () => {
    expect(deriveScore('DQI', 10, 10)).toBe(10.0)
  })

  it('oltre 100% → clamp a 10.0', () => {
    expect(deriveScore('TRS', 20, 10)).toBe(10.0)
  })
})

describe('deriveScore — AI (metrica conteggio)', () => {
  it('numerator=0 → 1.0', () => {
    expect(deriveScore('AI', 0, 0)).toBe(1.0)
  })

  it('numerator=1 → 1.9', () => {
    // 1 + 1 * 0.9 = 1.9
    expect(deriveScore('AI', 1, 0)).toBe(1.9)
  })

  it('numerator=10 → 10.0', () => {
    // 1 + 10 * 0.9 = 10.0
    expect(deriveScore('AI', 10, 0)).toBe(10.0)
  })

  it('numerator=20 → clamp a 10.0', () => {
    expect(deriveScore('AI', 20, 0)).toBe(10.0)
  })
})

describe('deriveScore — VCI (frequenza eventi/minuto)', () => {
  it('denominator=0 → null', () => {
    expect(deriveScore('VCI', 3, 0)).toBeNull()
  })

  it('0 eventi/min → 1.0', () => {
    expect(deriveScore('VCI', 0, 5)).toBe(1.0)
  })

  it('2 eventi/min → 10.0', () => {
    // ratePerMin=2; 1 + (2/2)*9 = 10
    expect(deriveScore('VCI', 4, 2)).toBe(10.0)
  })

  it('1 evento/min → 5.5', () => {
    // 1 + (1/2)*9 = 5.5
    expect(deriveScore('VCI', 3, 3)).toBe(5.5)
  })
})

describe('deriveScore — metrica sconosciuta', () => {
  it('→ null', () => {
    expect(deriveScore('XYZ', 5, 10)).toBeNull()
  })
})

// ── deriveReliability ─────────────────────────────────────────────────────────

describe('deriveReliability — SR (min_n=15, half=7)', () => {
  it('denominator < 7 → insufficient', () => {
    expect(deriveReliability('SR', 3, 5)).toBe('insufficient')
  })
  it('7 ≤ denominator < 15 → low', () => {
    expect(deriveReliability('SR', 8, 10)).toBe('low')
  })
  it('15 ≤ denominator < 30 → medium', () => {
    expect(deriveReliability('SR', 15, 20)).toBe('medium')
  })
  it('denominator ≥ 30 → high', () => {
    expect(deriveReliability('SR', 30, 30)).toBe('high')
  })
})

describe('deriveReliability — DQI (min_n=20, half=10)', () => {
  it('denominator < 10 → insufficient', () => {
    expect(deriveReliability('DQI', 5, 5)).toBe('insufficient')
  })
  it('10 ≤ denominator < 20 → low', () => {
    expect(deriveReliability('DQI', 15, 15)).toBe('low')
  })
  it('20 ≤ denominator < 40 → medium', () => {
    expect(deriveReliability('DQI', 20, 25)).toBe('medium')
  })
  it('denominator ≥ 40 → high', () => {
    expect(deriveReliability('DQI', 40, 40)).toBe('high')
  })
})

describe('deriveReliability — AI (soglie 3/6/10 su numerator)', () => {
  it('numerator < 3 → insufficient', () => {
    expect(deriveReliability('AI', 2, 0)).toBe('insufficient')
  })
  it('3 ≤ numerator < 6 → low', () => {
    expect(deriveReliability('AI', 4, 0)).toBe('low')
  })
  it('6 ≤ numerator < 10 → medium', () => {
    expect(deriveReliability('AI', 7, 0)).toBe('medium')
  })
  it('numerator ≥ 10 → high', () => {
    expect(deriveReliability('AI', 10, 0)).toBe('high')
  })
})

// ── FIELD_TO_METRIC ───────────────────────────────────────────────────────────

describe('FIELD_TO_METRIC', () => {
  it('mappa tutti i 5 campi Measurement ai rispettivi label', () => {
    expect(FIELD_TO_METRIC.scanning_rate).toBe('SR')
    expect(FIELD_TO_METRIC.decision_quality).toBe('DQI')
    expect(FIELD_TO_METRIC.anticipation).toBe('AI')
    expect(FIELD_TO_METRIC.transition_reset).toBe('TRS')
    expect(FIELD_TO_METRIC.verbal_comm).toBe('VCI')
  })

  it('ha esattamente 5 campi', () => {
    expect(Object.keys(FIELD_TO_METRIC)).toHaveLength(5)
  })
})
