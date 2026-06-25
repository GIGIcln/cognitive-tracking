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

  // The page opens on "Presenze" tab — click "Cognitivo" to reveal save button
  await page.getByRole('button', { name: 'Cognitivo' }).first().click()
  await expect(page.getByRole('button', { name: 'Salva sessione', exact: true })).toBeVisible({ timeout: 12_000 })
}

// ── SR multi-row helpers ──────────────────────────────────────────────────────
// SRMultiRowInput renders one row per reception.
// Each row: input[min="0"] = numerator (check pre-tocco), input[min="1"] = denominator (sec).
// Reliability = deriveSRReliability(n) where n = rows with denominator > 0.
// <3 → insufficient (gate blocks), <6 → low, <12 → medium, ≥12 → high.

function srSection(page: Parameters<typeof test>[1]) {
  return page.getByTestId('sr-multi-row-input')
}

function addSRReception(page: Parameters<typeof test>[1]) {
  return page.getByRole('button', { name: /Aggiungi ricezione/ })
}

function srDenominator(page: Parameters<typeof test>[1], rowIndex: number) {
  // denominator inputs have min="1" (seconds); numerator have min="0"
  return srSection(page).locator('input[type="number"][min="1"]').nth(rowIndex)
}

// ── Gate message selector (desktop) ──────────────────────────────────────────

function desktopGateMsg(page: Parameters<typeof test>[1]) {
  return page.locator('span.shrink-0').filter({ hasText: /dati insufficienti/ })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Gate di affidabilità (SessionDetailPage)', () => {
  test('dati SR insufficienti bloccano il salvataggio', async ({ page }) => {
    await mountSession(page)

    const saveBtn = page.getByRole('button', { name: 'Salva sessione', exact: true })

    // Before any input: no gate message, save button enabled
    await expect(saveBtn).toBeEnabled()
    await expect(desktopGateMsg(page)).not.toBeVisible()

    // Add 1 reception: n=1 → deriveSRReliability(1) = 'insufficient' → gate blocks
    await addSRReception(page).click()
    await srDenominator(page, 0).fill('3')
    await srDenominator(page, 0).press('Tab')

    await expect(desktopGateMsg(page)).toBeVisible({ timeout: 5_000 })
    await expect(saveBtn).toBeDisabled()
  })

  test('portare SR a soglia sufficiente sblocca il salvataggio', async ({ page }) => {
    await mountSession(page)

    const saveBtn = page.getByRole('button', { name: 'Salva sessione', exact: true })

    // 1 reception → n=1 → 'insufficient' → gate blocks
    await addSRReception(page).click()
    await srDenominator(page, 0).fill('3')
    await srDenominator(page, 0).press('Tab')

    await expect(saveBtn).toBeDisabled()
    await expect(desktopGateMsg(page)).toBeVisible()

    // Add 2 more receptions → n=3 → deriveSRReliability(3) = 'low' → gate clears
    await addSRReception(page).click()
    await srDenominator(page, 1).fill('3')
    await addSRReception(page).click()
    await srDenominator(page, 2).fill('3')
    await srDenominator(page, 2).press('Tab')

    await expect(desktopGateMsg(page)).not.toBeVisible({ timeout: 5_000 })
    await expect(saveBtn).toBeEnabled()
  })
})
