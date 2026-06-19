import api from './axios'

export const saveEvents = (sessionId, events) =>
  api.post(`/sessions/${sessionId}/events`, { events })

export const getEvents = (sessionId) =>
  api.get(`/sessions/${sessionId}/events`)
