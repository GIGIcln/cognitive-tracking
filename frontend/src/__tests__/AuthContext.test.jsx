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

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('inizializzazione al mount', () => {
    it('senza token → isLoading=false, user=null, getMe non chiamato', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.user).toBeNull()
      expect(authApi.getMe).not.toHaveBeenCalled()
    })

    it('con token valido → user popolato', async () => {
      localStorage.setItem('ct_token', 'valid-token')
      authApi.getMe.mockResolvedValue({
        data: { id: '1', email: 'a@b.it', full_name: 'Admin', is_active: true },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toEqual({
        id: '1', email: 'a@b.it', full_name: 'Admin', is_active: true,
      })
    })

    it('con token scaduto (getMe fallisce) → token rimosso, user=null', async () => {
      localStorage.setItem('ct_token', 'expired-token')
      authApi.getMe.mockRejectedValue(new Error('Unauthorized'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('ct_token')).toBeNull()
    })
  })

  describe('login()', () => {
    it('setta token in localStorage e popola user', async () => {
      authApi.login.mockResolvedValue({ data: { access_token: 'new-token' } })
      authApi.getMe.mockResolvedValue({
        data: { id: '1', email: 'a@b.it', full_name: 'Admin', is_active: true },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.login('a@b.it', 'Password1!')
      })

      expect(localStorage.getItem('ct_token')).toBe('new-token')
      expect(result.current.user).toEqual({
        id: '1', email: 'a@b.it', full_name: 'Admin', is_active: true,
      })
      expect(authApi.login).toHaveBeenCalledWith('a@b.it', 'Password1!')
    })

    it('credenziali errate → rilancia errore senza modificare lo state', async () => {
      authApi.login.mockRejectedValue(new Error('Credenziali non valide'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await expect(
        act(async () => { await result.current.login('wrong@b.it', 'wrong') })
      ).rejects.toThrow('Credenziali non valide')

      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('ct_token')).toBeNull()
    })
  })

  describe('logout()', () => {
    it('azzera user e chiama apiLogout', async () => {
      localStorage.setItem('ct_token', 'valid-token')
      authApi.getMe.mockResolvedValue({
        data: { id: '1', email: 'a@b.it', full_name: 'Admin', is_active: true },
      })
      authApi.logout.mockImplementation(() => {
        localStorage.removeItem('ct_token')
      })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.user).not.toBeNull())

      act(() => { result.current.logout() })

      expect(result.current.user).toBeNull()
      expect(authApi.logout).toHaveBeenCalledOnce()
    })
  })
})
