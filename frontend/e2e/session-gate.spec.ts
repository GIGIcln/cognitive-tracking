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
// Uses URL.pathname to avoid matching Vite source files (/src/api/*.js)

async function mountSession(page: Parameters<typeof test>[1]) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const path = new URL(route.request().url()).pathname

      if (path === '/api/auth/me') {
        return route.fulfill({ status: 200, json: ADMIN_USER })
      }
      if (path === '/api/sessions/session-1/events') {
        return route.fulfill({ status: 200, json: [] })
      }
      if (path === '/api/sessions/session-1') {
        return route.fulfill({ status: 200, json: SESSION })
      }
      if (path.startsWith('/api/players')) {
        return route.fulfill({ status: 200, json: PLAYERS_RESPONSE })
      }
      if (path === '/api/groups/group-1/targets') {
        return route.fulfill({ status: 200, json: [] })
      }
      // Fallback for nav/sidebar calls
      return route.fulfill({ status: 200, json: {} })
    },
  )

  await page.goto('/sessions/session-1')

  // Wait until the save button is visible — confirms session + players loaded
  await expect(page.getByRole('button', { name: /Salva sessione/ })).toBeVisible({ timeout: 12_000 })
}

// ── Compact EventParamRow selectors (desktop layout) ─────────────────────────
// Each compact row is a .rounded-lg div containing the metric label text.
// SR (count_only=false) has two inputs: index 0 → numerator, index 1 → denominator.

function srInputs(page: Parameters<typeof test>[1]) {
  const srRow = page.locator('.rounded-lg').filter({ hasText: 'Scanning Rate' })
  return {
    numerator: srRow.locator('input[type="number"]').nth(0),
    denominator: srRow.locator('input[type="number"]').nth(1),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// The desktop gate message is a <span class="...shrink-0 text-red-600...">.
// The mobile counterpart is a <div> inside md:hidden — same text, different tag.
// Using span.shrink-0 avoids strict-mode violations from the hidden mobile clone.
function desktopGateMsg(page: Parameters<typeof test>[1]) {
  return page.locator('span.shrink-0').filter({ hasText: /dati insufficienti/ })
}

test.describe('Gate di affidabilità (SessionDetailPage)', () => {
  test('dati SR insufficienti bloccano il salvataggio', async ({ page }) => {
    await mountSession(page)

    const saveBtn = page.getByRole('button', { name: 'Salva sessione', exact: true })
    const { numerator, denominator } = srInputs(page)

    // Before any input: no gate message, save button enabled
    await expect(saveBtn).toBeEnabled()
    await expect(desktopGateMsg(page)).not.toBeVisible()

    // SR: numerator=1, denominator=3 → reliability 'insufficient' (3 < floor(15/2)=7)
    await numerator.fill('1')
    await denominator.fill('3')
    await denominator.press('Tab') // blur triggers React state update

    await expect(desktopGateMsg(page)).toBeVisible({ timeout: 5_000 })
    await expect(saveBtn).toBeDisabled()
  })

  test('portare SR a soglia sufficiente sblocca il salvataggio', async ({ page }) => {
    await mountSession(page)

    const saveBtn = page.getByRole('button', { name: 'Salva sessione', exact: true })
    const { numerator, denominator } = srInputs(page)

    // Enter insufficient data first
    await numerator.fill('1')
    await denominator.fill('3')
    await denominator.press('Tab')

    await expect(saveBtn).toBeDisabled()
    await expect(desktopGateMsg(page)).toBeVisible()

    // Raise denominator to 20 → reliability 'medium' (20 >= min_n=15) → gate clears
    await denominator.fill('20')
    await denominator.press('Tab')

    await expect(desktopGateMsg(page)).not.toBeVisible({ timeout: 5_000 })
    await expect(saveBtn).toBeEnabled()
  })
})
