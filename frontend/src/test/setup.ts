import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Node.js 22+ definisce localStorage nativo (undefined senza --localstorage-file),
// oscurando quello di jsdom. Questo mock garantisce localStorage funzionante.
const _ls: Record<string, string> = {}
const localStorageMock = {
  getItem: (k: string) => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
  setItem: (k: string, v: string) => { _ls[k] = String(v) },
  removeItem: (k: string) => { delete _ls[k] },
  clear: () => { Object.keys(_ls).forEach((k) => delete _ls[k]) },
  get length() { return Object.keys(_ls).length },
  key: (i: number) => Object.keys(_ls)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// Stub window.location per evitare "Not implemented: navigation" in jsdom
Object.defineProperty(window, 'location', {
  value: {
    replace: vi.fn(),
    assign: vi.fn(),
    reload: vi.fn(),
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
  configurable: true,
})
