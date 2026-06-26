import { test, expect } from '@playwright/test'

// ── Fixture data ──────────────────────────────────────────────────────────────

const ADMIN_USER = { email: 'admin@test.it', roles: ['admin'], group_ids: [] }

const SEASON = {
  id: 'season-1',
  name: '2026-27',
  is_current: true,
  start_date: '2026-09-01',
  end_date: '2027-06-30',
}

const GROUP = {
  id: 'group-1',
  name: 'Esordienti A',
  category: 'Giovanili',
  level: 'alto',
  birth_year: 2013,
  sub_group: null,
  max_players: 18,
}

// ── Helper: mount sessions list page with context mocked ─────────────────────

async function mountSessionsPage(page: Parameters<typeof test>[1]) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const path = new URL(route.request().url()).pathname

      if (path === '/api/auth/me')        return route.fulfill({ status: 200, json: ADMIN_USER })
      if (path === '/api/seasons')        return route.fulfill({ status: 200, json: [SEASON] })
      if (path === '/api/seasons/current') return route.fulfill({ status: 200, json: SEASON })
      if (path === '/api/groups')         return route.fulfill({ status: 200, json: [GROUP] })
      if (path === '/api/sessions')       return route.fulfill({ status: 200, json: { items: [], total: 0 } })
      return route.fulfill({ status: 200, json: {} })
    },
  )

  await page.goto('/sessions')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Creazione sessione (SessionsPage)', () => {
  test('Il pulsante Nuova sessione è visibile per admin', async ({ page }) => {
    await mountSessionsPage(page)

    await expect(page.getByRole('button', { name: /Nuova sessione/ })).toBeVisible({ timeout: 10_000 })
  })

  test('La modal si apre con il gruppo e il pulsante di conferma', async ({ page }) => {
    await mountSessionsPage(page)

    await page.getByRole('button', { name: /Nuova sessione/ }).click()

    // Modal header
    await expect(page.getByRole('heading', { name: 'Nuova sessione' })).toBeVisible({ timeout: 5_000 })

    // Group dropdown includes our group
    await expect(page.getByRole('option', { name: 'Esordienti A' })).toBeAttached({ timeout: 5_000 })

    // Submit button present and enabled
    await expect(page.getByRole('button', { name: 'Crea sessione' })).toBeVisible()
  })
})
