import api from './axios'

export const getPlayers = (groupId) =>
  api.get('/players', { params: groupId ? { group_id: groupId } : {} })

export const getPlayer = (playerId, config) => api.get(`/players/${playerId}`, config)

export const createPlayer = (data) => api.post('/players', data)
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data)
export const assignPlayer = (id, groupId) =>
  api.post(`/players/${id}/assign`, { group_id: groupId })
export const deletePlayer = (id) => api.delete(`/players/${id}`)
export const getPlayerHistory = (playerId, config) => api.get(`/players/${playerId}/history`, config)
export const getPlayerAssignments = (playerId) => api.get(`/players/${playerId}/assignments`)
export const getAtRiskPlayers = (minSessions = 3) =>
  api.get('/players/at-risk', { params: { min_sessions: minSessions } })
export const getPlayerStreak = (playerId) => api.get(`/players/${playerId}/streak`)
export const bulkAssignPlayers = (playerIds, groupId) =>
  api.post('/players/bulk-assign', { player_ids: playerIds, group_id: groupId })
