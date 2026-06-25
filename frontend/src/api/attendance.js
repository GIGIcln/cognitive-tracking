import axios from './axios'

export const getAttendance = (sessionId) =>
  axios.get(`/sessions/${sessionId}/attendance`)

export const saveAttendance = (sessionId, records) =>
  axios.put(`/sessions/${sessionId}/attendance`, { records })
