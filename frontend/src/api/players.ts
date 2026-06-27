import api from './axios'
import type { AxiosRequestConfig } from 'axios'

export const getPlayers = (groupId?: string | null, limit?: number) =>
  api.get('/players', { params: { ...(groupId ? { group_id: groupId } : {}), ...(limit ? { limit } : {}) } })

export const getPlayer = (playerId: string, config?: AxiosRequestConfig) => api.get(`/players/${playerId}`, config)

export const createPlayer = (data: unknown) => api.post('/players', data)
export const updatePlayer = (id: string, data: unknown) => api.put(`/players/${id}`, data)
export const assignPlayer = (id: string, groupId: string) =>
  api.post(`/players/${id}/assign`, { group_id: groupId })
export const deletePlayer = (id: string) => api.delete(`/players/${id}`)
export const getPlayerHistory = (playerId: string, config?: AxiosRequestConfig) => api.get(`/players/${playerId}/history`, config)
export const getPlayerAssignments = (playerId: string) => api.get(`/players/${playerId}/assignments`)
export const getAtRiskPlayers = (minSessions = 3) =>
  api.get('/players/at-risk', { params: { min_sessions: minSessions } })
export const getPlayerStreak = (playerId: string) => api.get(`/players/${playerId}/streak`)
export const getPlayerSummary = (playerId: string, seasonId?: string) =>
  api.get(`/players/${playerId}/summary`, { params: seasonId ? { season_id: seasonId } : {} })
export const bulkAssignPlayers = (playerIds: string[], groupId: string) =>
  api.post('/players/bulk-assign', { player_ids: playerIds, group_id: groupId })
