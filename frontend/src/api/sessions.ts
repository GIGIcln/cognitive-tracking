import api from './axios'
import type { AxiosRequestConfig } from 'axios'

export const getSessions = (groupId?: string | null, limit?: number, seasonId?: string | null) =>
  api.get('/sessions', { params: { ...(groupId ? { group_id: groupId } : {}), ...(seasonId ? { season_id: seasonId } : {}), ...(limit ? { limit } : {}) } })

export const createSession = (data: unknown) => api.post('/sessions', data)
export const deleteSession = (id: string) => api.delete(`/sessions/${id}`)
export const getSession = (id: string) => api.get(`/sessions/${id}`)
export const saveMeasurements = (sessionId: string, measurements: unknown[]) =>
  api.post(`/sessions/${sessionId}/measurements`, { measurements })
export const getMeasurements = (sessionId: string) =>
  api.get(`/sessions/${sessionId}/measurements`)
export const updateSession = (id: string, data: unknown) => api.patch(`/sessions/${id}`, data)
export const getSessionAverages = (sessionId: string, config?: AxiosRequestConfig) =>
  api.get(`/sessions/${sessionId}/averages`, config)
export const getSessionRankings = (sessionId: string, config?: AxiosRequestConfig) =>
  api.get(`/sessions/${sessionId}/rankings`, config)
