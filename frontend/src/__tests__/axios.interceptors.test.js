import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'

// Hoisted mock: vitest intercetta anche dynamic import('../utils/offlineQueue')
vi.mock('../utils/offlineQueue', () => ({
  addToQueue: vi.fn().mockResolvedValue(undefined),
  getAllItems: vi.fn().mockResolvedValue([]),
  getCount: vi.fn().mockResolvedValue(0),
  removeItem: vi.fn().mockResolvedValue(undefined),
  incrementRetry: vi.fn().mockResolvedValue(undefined),
}))

import api from '../api/axios'
import * as offlineQueue from '../utils/offlineQueue'

describe('axios interceptors', () => {
  let mock

  beforeEach(() => {
    api.defaults.baseURL = ''
    mock = new MockAdapter(api)
    localStorage.clear()
  })

  afterEach(() => {
    mock.restore()
    api.defaults.baseURL = '/api'
  })

  // ── Request interceptor ───────────────────────────────────────────────────

  describe('Request interceptor', () => {
    it('non aggiunge Authorization header — auth avviene via cookie HttpOnly', async () => {
      let capturedHeaders

      mock.onGet('/groups').reply((config) => {
        capturedHeaders = config.headers
        return [200, []]
      })

      await api.get('/groups')
      expect(capturedHeaders.Authorization).toBeUndefined()
    })
  })

  // ── Interceptor 401 ───────────────────────────────────────────────────────

  describe('Response interceptor — gestione 401', () => {
    it('401 su endpoint non-auth → redirect a /login', async () => {
      mock.onGet('/sessions').reply(401)

      await api.get('/sessions').catch(() => {})

      expect(window.location.replace).toHaveBeenCalledWith('/login')
    })

    it('401 su /auth/me → NON fa redirect (check sessione iniziale al caricamento)', async () => {
      mock.onGet('/auth/me').reply(401)
      const replaceSpy = vi.spyOn(window.location, 'replace')

      await api.get('/auth/me').catch(() => {})

      expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('401 su /auth/login → NON fa redirect (credenziali errate, gestito dal componente)', async () => {
      mock.onPost('/auth/login').reply(401)
      const replaceSpy = vi.spyOn(window.location, 'replace')

      await api.post('/auth/login', {}).catch(() => {})

      expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('401 su endpoint non-auth → non modifica localStorage (token gestito via cookie)', async () => {
      localStorage.setItem('ct_token', 'residual-value')
      mock.onGet('/players').reply(401)

      await api.get('/players').catch(() => {})

      expect(localStorage.getItem('ct_token')).toBe('residual-value')
    })
  })

  // ── Interceptor offline queue ─────────────────────────────────────────────

  describe('Response interceptor — offline queue', () => {
    it('POST con errore di rete → operazione accodata offline', async () => {
      mock.onPost('/sessions').networkError()

      const err = await api.post('/sessions', { group_id: '123' }).catch((e) => e)

      expect(offlineQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', url: '/sessions' })
      )
      expect(err.isOfflineQueued).toBe(true)
    })

    it('GET con errore di rete → NON accodato (sola lettura)', async () => {
      mock.onGet('/groups').networkError()

      await api.get('/groups').catch(() => {})

      expect(offlineQueue.addToQueue).not.toHaveBeenCalled()
    })

    it('POST su /auth/* con errore di rete → NON accodato', async () => {
      mock.onPost('/auth/login').networkError()

      await api.post('/auth/login', {}).catch(() => {})

      expect(offlineQueue.addToQueue).not.toHaveBeenCalled()
    })

    it('PUT con errore di rete → operazione accodata offline', async () => {
      mock.onPut('/players/abc').networkError()

      await api.put('/players/abc', { name: 'Mario' }).catch(() => {})

      expect(offlineQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PUT', url: '/players/abc' })
      )
    })
  })
})
