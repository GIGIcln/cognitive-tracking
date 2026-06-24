import axios from './axios'

export const listMatches = (params = {}) =>
  axios.get('/matches', { params })

export const getMatch = (id) =>
  axios.get(`/matches/${id}`)

export const createMatch = (body) =>
  axios.post('/matches', body)

export const updateMatch = (id, body) =>
  axios.patch(`/matches/${id}`, body)

export const saveLineup = (id, lineups) =>
  axios.put(`/matches/${id}/lineup`, { lineups })

export const deleteMatch = (id) =>
  axios.delete(`/matches/${id}`)
