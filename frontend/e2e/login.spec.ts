import { test, expect } from '@playwright/test'

const ADMIN_USER = { email: 'admin@test.it', roles: ['admin'], group_ids: [] }

// Only intercept real API calls (/api/*), NOT Vite source files (/src/api/*.js)
function setupLoginMocks(page: Parameters<typeof test>[1]) {
  return page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const url = route.request().url()

      if (url.includes('/api/auth/me')) {
        return route.fulfill({ status: 401, json: { detail: 'Unauthorized' } })
      }
      if (url.includes('/api/auth/login')) {
        const body = route.request().postDataJSON() as { email?: string }
        if (body?.email === 'admin@test.it') {
          return route.fulfill({ status: 200, json: { user: ADMIN_USER } })
        }
        return route.fulfill({ status: 401, json: { detail: 'Credenziali non valide' } })
      }
      // Other dashboard calls (groups, sessions, players, seasons…)
      return route.fulfill({ status: 200, json: { items: [], total: 0 } })
    },
  )
}

test.describe('Login', () => {
  test('rende il form con email, password e pulsante Accedi', async ({ page }) => {
    await setupLoginMocks(page)
    await page.goto('/')

    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible()
  })

  test('credenziali valide navigano alla dashboard', async ({ page }) => {
    await setupLoginMocks(page)
    await page.goto('/')

    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })

    await page.locator('input[type="email"]').fill('admin@test.it')
    await page.locator('input[type="password"]').fill('password123')
    await page.getByRole('button', { name: 'Accedi' }).click()

    // AuthContext sets user from login response, then LoginPage navigates to /
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('credenziali errate mostrano messaggio di errore', async ({ page }) => {
    await setupLoginMocks(page)
    await page.goto('/login')

    // Wait for the login form to be ready
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 })

    await page.locator('input[type="email"]').fill('sbagliato@test.it')
    await page.locator('input[type="password"]').fill('wrongpass')
    await page.getByRole('button', { name: 'Accedi' }).click()

    await expect(page.getByText('Credenziali non valide')).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
