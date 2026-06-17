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
    // Rimuove baseURL per URL matching semplice con MockAdapter
    api.defaults.baseURL = ''
    mock = new MockAdapter(api)
    localStorage.clear()
  })

  afterEach(() => {
    mock.restore()
    api.defaults.baseURL = '/api'
  })

  // ── Interceptor 1: JWT injection ──────────────────────────────────────────

  describe('Request interceptor — JWT injection', () => {
    it('aggiunge Authorization header quando il token è presente', async () => {
      localStorage.setItem('ct_token', 'my-jwt-token')
      let capturedHeaders

      mock.onGet('/groups').reply((config) => {
        capturedHeaders = config.headers
        return [200, []]
      })

      await api.get('/groups')
      expect(capturedHeaders.Authorization).toBe('Bearer my-jwt-token')
    })

    it('non aggiunge Authorization header se nessun token', async () => {
      let capturedHeaders

      mock.onGet('/groups').reply((config) => {
        capturedHeaders = config.headers
        return [200, []]
      })

      await api.get('/groups')
      expect(capturedHeaders.Authorization).toBeUndefined()
    })
  })

  // ── Interceptor 2: gestione 401 ───────────────────────────────────────────

  describe('Response interceptor — gestione 401', () => {
    it('401 su endpoint non-auth → rimuove token dal localStorage', async () => {
      localStorage.setItem('ct_token', 'valid-token')
      mock.onGet('/sessions').reply(401)

      await api.get('/sessions').catch(() => {})

      expect(localStorage.getItem('ct_token')).toBeNull()
      expect(window.location.replace).toHaveBeenCalledWith('/login')
    })

    it('401 su /auth/login → token rimane (errore credenziali, non di sessione)', async () => {
      localStorage.setItem('ct_token', 'valid-token')
      mock.onPost('/auth/login').reply(401)

      await api.post('/auth/login', {}).catch(() => {})

      // Il token NON deve essere rimosso: è un errore di credenziali
      expect(localStorage.getItem('ct_token')).toBe('valid-token')
    })
  })

  // ── Interceptor 3: offline queue ──────────────────────────────────────────

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
