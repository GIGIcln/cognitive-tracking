import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { OfflineContextProvider, useOffline } from '../context/OfflineContext'

vi.mock('../utils/offlineQueue', () => ({
  addToQueue: vi.fn().mockResolvedValue(undefined),
  getAllItems: vi.fn().mockResolvedValue([]),
  getCount: vi.fn().mockResolvedValue(0),
  removeItem: vi.fn().mockResolvedValue(undefined),
  incrementRetry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => ({ isOnline: true })),
}))

// Ping mockato di default come raggiungibile — i test che simulano server_down lo sovrascrivono
vi.mock('../utils/serverPing', () => ({
  checkServerReachable: vi.fn().mockResolvedValue(true),
}))

import * as offlineQueue from '../utils/offlineQueue'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import * as serverPing from '../utils/serverPing'

const wrapper = ({ children }) => <OfflineContextProvider>{children}</OfflineContextProvider>

describe('OfflineContext', () => {
  beforeEach(() => {
    localStorage.clear()
    offlineQueue.getCount.mockResolvedValue(0)
    offlineQueue.getAllItems.mockResolvedValue([])
    offlineQueue.addToQueue.mockResolvedValue(undefined)
    offlineQueue.removeItem.mockResolvedValue(undefined)
    offlineQueue.incrementRetry.mockResolvedValue(undefined)
    useOnlineStatus.mockReturnValue({ isOnline: true })
    serverPing.checkServerReachable.mockResolvedValue(true)
  })

  // ── Stato iniziale ──────────────────────────────────────────────────────

  it('pendingCount iniziale è 0', async () => {
    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))
    expect(result.current.syncError).toBeNull()
    expect(result.current.isSyncing).toBe(false)
  })

  it('serverStatus iniziale è online quando isOnline=true e ping ok', async () => {
    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.serverStatus).toBe('online'))
  })

  // ── addToQueue ──────────────────────────────────────────────────────────

  it('addToQueue aggiunge alla coda e aggiorna pendingCount', async () => {
    offlineQueue.getCount
      .mockResolvedValueOnce(0)  // mount
      .mockResolvedValue(1)      // tutte le chiamate successive (addItem + re-render polling)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => {
      await result.current.addToQueue({ url: '/sessions', method: 'POST', body: {} })
    })

    expect(offlineQueue.addToQueue).toHaveBeenCalledWith({
      url: '/sessions', method: 'POST', body: {},
    })
    expect(result.current.pendingCount).toBe(1)
  })

  // ── syncNow — errori HTTP ────────────────────────────────────────────────

  it('syncNow con item → 4xx → rimuove item senza retry (errore client permanente)', async () => {
    const item = {
      id: 42, url: '/sessions', method: 'POST',
      body: { group_id: 'g1' }, retries: 0, nextRetryAt: 0, timestamp: Date.now(),
    }
    offlineQueue.getAllItems.mockResolvedValue([item])
    offlineQueue.getCount.mockResolvedValue(0)
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 422 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(offlineQueue.removeItem).toHaveBeenCalledWith(42)
    expect(offlineQueue.incrementRetry).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('syncNow con item → 5xx → chiama incrementRetry, non rimuove (< MAX_RETRIES)', async () => {
    const item = {
      id: 99, url: '/sessions', method: 'POST',
      body: { group_id: 'g1' }, retries: 0, nextRetryAt: 0, timestamp: Date.now(),
    }
    offlineQueue.getAllItems.mockResolvedValue([item])
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(offlineQueue.incrementRetry).toHaveBeenCalledWith(99)
    expect(offlineQueue.removeItem).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('syncNow → 5xx con retries=4 (max raggiunto) → rimuove item e imposta syncError', async () => {
    const item = {
      id: 55, url: '/sessions', method: 'POST',
      body: {}, retries: 4, nextRetryAt: 0, timestamp: Date.now(),
    }
    offlineQueue.getAllItems.mockResolvedValue([item])
    offlineQueue.getCount.mockResolvedValue(0)
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(offlineQueue.removeItem).toHaveBeenCalledWith(55)
    expect(result.current.syncError).toBeTruthy()

    vi.unstubAllGlobals()
  })

  // ── syncNow — coda vuota / item ok ────────────────────────────────────

  it('syncNow con coda vuota → chiama getAllItems, nessun fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(offlineQueue.getAllItems).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.syncError).toBeNull()
    expect(result.current.isSyncing).toBe(false)

    vi.unstubAllGlobals()
  })

  it('syncNow con item scaduto (> 7 giorni) → rimuove senza fetch e imposta syncError', async () => {
    const staleItem = {
      id: 77, url: '/sessions', method: 'POST',
      body: {}, retries: 0, nextRetryAt: 0,
      timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,  // 8 giorni fa
    }
    offlineQueue.getAllItems.mockResolvedValue([staleItem])
    offlineQueue.getCount.mockResolvedValue(0)
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(offlineQueue.removeItem).toHaveBeenCalledWith(77)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.syncError).toBeTruthy()

    vi.unstubAllGlobals()
  })

  it('syncNow con item → invia fetch con credentials:include e rimuove item se ok', async () => {
    const item = {
      id: 1, url: '/sessions', method: 'POST',
      body: { group_id: 'g1' }, retries: 0, nextRetryAt: 0, timestamp: Date.now(),
    }
    offlineQueue.getAllItems.mockResolvedValue([item])
    offlineQueue.getCount.mockResolvedValue(0)

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(mockFetch).toHaveBeenCalledWith(
      '/sessions',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    )
    expect(offlineQueue.removeItem).toHaveBeenCalledWith(1)

    vi.unstubAllGlobals()
  })

  // ── Sync automatica al ripristino della connessione ────────────────────

  it('syncNow con item valido → non viene filtrato dalla expiry', async () => {
    const item = {
      id: 88, url: '/sessions', method: 'POST',
      body: {}, retries: 0, nextRetryAt: 0, timestamp: Date.now(),
    }
    offlineQueue.getAllItems.mockResolvedValue([item])
    offlineQueue.getCount.mockResolvedValue(0)
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(mockFetch).toHaveBeenCalled()
    expect(offlineQueue.removeItem).toHaveBeenCalledWith(88)

    vi.unstubAllGlobals()
  })

  it('tornare online innesca syncNow automaticamente', async () => {
    // Parte offline
    useOnlineStatus.mockReturnValue({ isOnline: false })

    const { result, rerender } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    const callsBefore = offlineQueue.getAllItems.mock.calls.length

    // Torna online (ping già mockato come ok)
    useOnlineStatus.mockReturnValue({ isOnline: true })
    rerender()

    // syncNow chiama getAllItems
    await waitFor(() =>
      expect(offlineQueue.getAllItems.mock.calls.length).toBeGreaterThan(callsBefore)
    )
  })

  // ── Server down ──────────────────────────────────────────────────────────

  it('server_down: serverStatus è server_down quando online ma ping fallisce', async () => {
    serverPing.checkServerReachable.mockResolvedValue(false)

    const { result } = renderHook(() => useOffline(), { wrapper })

    await waitFor(() => expect(result.current.serverStatus).toBe('server_down'))
    expect(result.current.isOnline).toBe(true)
  })

  it('server_down: syncNow non esegue e non chiama getAllItems', async () => {
    serverPing.checkServerReachable.mockResolvedValue(false)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.serverStatus).toBe('server_down'))

    const callsBefore = offlineQueue.getAllItems.mock.calls.length

    await act(async () => { await result.current.syncNow() })

    expect(offlineQueue.getAllItems.mock.calls.length).toBe(callsBefore)
  })

  it('server_down: quando il server torna raggiungibile, syncNow è invocata automaticamente', async () => {
    // Avvia con server non raggiungibile
    serverPing.checkServerReachable.mockResolvedValue(false)
    useOnlineStatus.mockReturnValue({ isOnline: true })

    const { result, rerender } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.serverStatus).toBe('server_down'))

    const callsBefore = offlineQueue.getAllItems.mock.calls.length

    // Simula ciclo offline → online con server ora raggiungibile.
    // Questo forza il re-run immediato del ping effect (non attende i 30s di interval).
    serverPing.checkServerReachable.mockResolvedValue(true)
    useOnlineStatus.mockReturnValue({ isOnline: false })
    rerender()
    await act(async () => {})

    useOnlineStatus.mockReturnValue({ isOnline: true })
    rerender()

    // Il ping scatta immediatamente → isServerReachable false→true → syncNow → getAllItems
    await waitFor(() =>
      expect(offlineQueue.getAllItems.mock.calls.length).toBeGreaterThan(callsBefore)
    )
  })
})
