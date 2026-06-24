import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../context/AuthContext'

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
}))

import * as authApi from '../api/auth'

const wrapper = ({ children }) => (
  <MemoryRouter>
    <AuthProvider>{children}</AuthProvider>
  </MemoryRouter>
)

const TEST_USER = { id: '1', email: 'a@b.it', full_name: 'Admin', is_active: true }

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: nessuna sessione attiva → 401 expected, non deve produrre console.warn
    authApi.getMe.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' })
  })

  describe('inizializzazione al mount', () => {
    it('getMe fallisce (nessuna sessione) → isLoading=false, user=null', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toBeNull()
      expect(authApi.getMe).toHaveBeenCalledOnce()
    })

    it('cookie valido → getMe ha successo → user popolato', async () => {
      authApi.getMe.mockResolvedValue({ data: TEST_USER })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toEqual(TEST_USER)
      expect(authApi.getMe).toHaveBeenCalledOnce()
    })

    it('cookie scaduto (getMe fallisce) → user=null, localStorage non toccato', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toBeNull()
      // Auth è gestita dal cookie HttpOnly: localStorage non viene mai scritto
      expect(localStorage.getItem('ct_token')).toBeNull()
    })

    it('errore non-401 da getMe → emette console.warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      authApi.getMe.mockRejectedValue({ response: { status: 500 }, message: 'Server Error' })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth]'),
        expect.anything()
      )
      expect(result.current.user).toBeNull()
      warnSpy.mockRestore()
    })
  })

  describe('login()', () => {
    it('login ok → user popolato dalla risposta, nessun token in localStorage', async () => {
      authApi.login.mockResolvedValue({
        data: { access_token: 'jwt-token', user: TEST_USER },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.login('a@b.it', 'Password1!')
      })

      expect(result.current.user).toEqual(TEST_USER)
      expect(authApi.login).toHaveBeenCalledWith('a@b.it', 'Password1!')
      expect(localStorage.getItem('ct_token')).toBeNull()
    })

    it('credenziali errate → rilancia errore, user resta null', async () => {
      authApi.login.mockRejectedValue(new Error('Credenziali non valide'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await expect(
        act(async () => { await result.current.login('wrong@b.it', 'wrong') })
      ).rejects.toThrow('Credenziali non valide')

      expect(result.current.user).toBeNull()
    })
  })

  describe('logout()', () => {
    it('azzera user e chiama apiLogout', async () => {
      authApi.getMe.mockResolvedValue({ data: TEST_USER })
      authApi.logout.mockResolvedValue({})

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.user).not.toBeNull())

      await act(async () => { await result.current.logout() })

      expect(result.current.user).toBeNull()
      expect(authApi.logout).toHaveBeenCalledOnce()
    })
  })
})
