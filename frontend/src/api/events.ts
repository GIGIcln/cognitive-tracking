import api from './axios'

export const saveEvents = (sessionId: string, events: unknown[]) =>
  api.post(`/sessions/${sessionId}/events`, { events })

export const getEvents = (sessionId: string) =>
  api.get(`/sessions/${sessionId}/events`)
