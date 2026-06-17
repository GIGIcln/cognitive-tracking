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

import * as offlineQueue from '../utils/offlineQueue'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

/** Crea un JWT con exp relativo a ora (in secondi) */
function makeJwt(expOffsetSec = 3600) {
  const payload = { sub: '1', exp: Math.floor(Date.now() / 1000) + expOffsetSec }
  return `header.${btoa(JSON.stringify(payload))}.signature`
}

const wrapper = ({ children }) => <OfflineContextProvider>{children}</OfflineContextProvider>

describe('OfflineContext', () => {
  beforeEach(() => {
    localStorage.clear()
    offlineQueue.getCount.mockResolvedValue(0)
    offlineQueue.getAllItems.mockResolvedValue([])
    offlineQueue.addToQueue.mockResolvedValue(undefined)
    offlineQueue.removeItem.mockResolvedValue(undefined)
    useOnlineStatus.mockReturnValue({ isOnline: true })
  })

  // ── Stato iniziale ──────────────────────────────────────────────────────

  it('pendingCount iniziale è 0', async () => {
    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))
    expect(result.current.syncError).toBeNull()
    expect(result.current.isSyncing).toBe(false)
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

  // ── syncNow — token assente/scaduto ─────────────────────────────────────

  it('syncNow senza token → imposta syncError', async () => {
    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(result.current.syncError).toBe(
      'Sessione scaduta: accedi di nuovo per completare la sincronizzazione.'
    )
    expect(result.current.isSyncing).toBe(false)
  })

  it('syncNow con token scaduto → imposta syncError', async () => {
    localStorage.setItem('ct_token', makeJwt(-3600)) // exp nel passato

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(result.current.syncError).toContain('Sessione scaduta')
  })

  // ── syncNow — token valido ─────────────────────────────────────────────

  it('syncNow con token valido e coda vuota → chiama getAllItems, nessun fetch', async () => {
    localStorage.setItem('ct_token', makeJwt())
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

  it('syncNow con item in coda → invia fetch e rimuove item se ok', async () => {
    localStorage.setItem('ct_token', makeJwt())

    const item = {
      id: 1, url: '/sessions', method: 'POST',
      body: { group_id: 'g1' }, retries: 0, nextRetryAt: 0,
    }
    offlineQueue.getAllItems.mockResolvedValue([item])
    offlineQueue.getCount.mockResolvedValue(0) // dopo rimozione

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    await act(async () => { await result.current.syncNow() })

    expect(mockFetch).toHaveBeenCalledWith(
      '/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
      })
    )
    expect(offlineQueue.removeItem).toHaveBeenCalledWith(1)

    vi.unstubAllGlobals()
  })

  // ── Sync automatica al ripristino della connessione ────────────────────

  it('tornare online innesca syncNow automaticamente', async () => {
    localStorage.setItem('ct_token', makeJwt())

    // Parte offline
    useOnlineStatus.mockReturnValue({ isOnline: false })

    const { result, rerender } = renderHook(() => useOffline(), { wrapper })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))

    const callsBefore = offlineQueue.getAllItems.mock.calls.length

    // Torna online
    useOnlineStatus.mockReturnValue({ isOnline: true })
    rerender()

    // syncNow chiama getAllItems
    await waitFor(() =>
      expect(offlineQueue.getAllItems.mock.calls.length).toBeGreaterThan(callsBefore)
    )
  })
})
