import api from './axios'
import type { AxiosRequestConfig } from 'axios'

export const getGroups = (seasonId?: string | null) =>
  api.get('/groups', { params: { ...(seasonId ? { season_id: seasonId } : {}) } })
export const getGroup = (id: string) => api.get(`/groups/${id}`)
export const createGroup = (data: unknown) => api.post('/groups', data)
export const updateGroup = (id: string, data: unknown) => api.patch(`/groups/${id}`, data)
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`)
export const getGroupTargets = (id: string, config?: AxiosRequestConfig) => api.get(`/groups/${id}/targets`, config)
export const updateGroupTargets = (id: string, targets: unknown) =>
  api.put(`/groups/${id}/targets`, targets)
export const getGroupHistory = (groupId: string, limit = 60) =>
  api.get(`/groups/${groupId}/history`, { params: { limit } })
export const getGroupChangelog = (groupId: string) => api.get(`/groups/${groupId}/changelog`)
export const getGroupAttendance = (groupId: string, limit = 20) =>
  api.get(`/groups/${groupId}/attendance`, { params: { limit } })
export const getGroupPlayerStats = (groupId: string) => api.get(`/groups/${groupId}/player_stats`)
