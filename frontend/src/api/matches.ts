import axios from './axios'

export const listMatches = (params: Record<string, unknown> = {}) =>
  axios.get('/matches', { params })

export const getMatch = (id: string) =>
  axios.get(`/matches/${id}`)

export const createMatch = (body: unknown) =>
  axios.post('/matches', body)

export const updateMatch = (id: string, body: unknown) =>
  axios.patch(`/matches/${id}`, body)

export const saveLineup = (id: string, lineups: unknown[]) =>
  axios.put(`/matches/${id}/lineup`, { lineups })

export const deleteMatch = (id: string) =>
  axios.delete(`/matches/${id}`)

export const getPlayerMatches = (playerId: string) =>
  axios.get(`/players/${playerId}/matches`)

export const getScorers = (params: Record<string, string> = {}) =>
  axios.get('/matches/scorers', { params })

export const getConvocations = (matchId: string) =>
  axios.get(`/matches/${matchId}/convocations`)

export const saveConvocations = (matchId: string, playerIds: string[]) =>
  axios.put(`/matches/${matchId}/convocations`, { player_ids: playerIds })
