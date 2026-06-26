import { test, expect } from '@playwright/test'

// ── Fixture data ──────────────────────────────────────────────────────────────

const ADMIN_USER = { email: 'admin@test.it', roles: ['admin'], group_ids: [] }

const SESSION = {
  id: 'session-1',
  group_id: 'group-1',
  session_date: '2026-06-24',
  session_type: 'SSG',
  duration_min: 60,
  notes: null,
  measurements: [],
}

const PLAYERS_RESPONSE = {
  items: [{ id: 'player-1', first_name: 'Marco', last_name: 'Rossi' }],
  total: 1,
}

// ── Helper: mount the session page with all API calls mocked ─────────────────
// With measurements=[] and events=[], useSessionForm auto-selects event mode.

async function mountSession(page: Parameters<typeof test>[1]) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const path = new URL(route.request().url()).pathname

      if (path === '/api/auth/me') return route.fulfill({ status: 200, json: ADMIN_USER })
      if (path === '/api/sessions/session-1/events') return route.fulfill({ status: 200, json: [] })
      if (path === '/api/sessions/session-1') return route.fulfill({ status: 200, json: SESSION })
      if (path.startsWith('/api/players')) return route.fulfill({ status: 200, json: PLAYERS_RESPONSE })
      if (path === '/api/groups/group-1/targets') return route.fulfill({ status: 200, json: [] })
      // SeasonGroupContext (React Query) needs arrays, not {} to avoid seasons.find crash
      if (path === '/api/seasons') return route.fulfill({ status: 200, json: [] })
      if (path === '/api/groups') return route.fulfill({ status: 200, json: [] })
      return route.fulfill({ status: 200, json: {} })
    },
  )

  await page.goto('/sessions/session-1')
  await page.getByRole('button', { name: 'Cognitivo' }).first().click()
  await expect(page.getByRole('button', { name: 'Salva sessione', exact: true })).toBeVisible({ timeout: 12_000 })
}

// Scope to desktop section (md:block) to avoid hidden mobile clone
function desktopSection(page: Parameters<typeof test>[1]) {
  return page.locator('.pb-28')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Inserimento eventi cognitivi (SessionDetailPage)', () => {
  // DQI config: min_n=20, half=10
  // Score formula: numerator/denominator * 9 + 1

  test('DQI medium: score e affidabilità derivati da numeratore/denominatore', async ({ page }) => {
    await mountSession(page)

    // event-param-dqi is the compact EventParamRow for decision_quality
    const dqiCard = desktopSection(page).getByTestId('event-param-dqi')
    // In compact mode: first input = numerator (N), second = denominator (D)
    const numInput = dqiCard.locator('input[type="number"]').first()
    const denInput = dqiCard.locator('input[type="number"]').nth(1)

    // denominator=20 → 20 >= min_n=20, 20 < min_n*2=40 → 'medium' → 'Affid. media'
    await denInput.fill('20')
    await denInput.press('Tab')
    // numerator=15 → rate=15/20=0.75 → score=0.75*9+1=7.75 → '7.8'
    await numInput.fill('15')
    await numInput.press('Tab')

    await expect(dqiCard.locator('span.rounded-full')).toContainText('7.8', { timeout: 5_000 })
    await expect(dqiCard.getByText('Affid. media')).toBeVisible({ timeout: 5_000 })
  })

  test('DQI bassa: denominatore < min_n mostra Affid. bassa', async ({ page }) => {
    await mountSession(page)

    const dqiCard = desktopSection(page).getByTestId('event-param-dqi')
    const numInput = dqiCard.locator('input[type="number"]').first()
    const denInput = dqiCard.locator('input[type="number"]').nth(1)

    // denominator=15: half=10 ≤ 15 < min_n=20 → 'low' → 'Affid. bassa'
    await denInput.fill('15')
    await denInput.press('Tab')
    await numInput.fill('10')
    await numInput.press('Tab')

    await expect(dqiCard.getByText('Affid. bassa')).toBeVisible({ timeout: 5_000 })
  })
})
