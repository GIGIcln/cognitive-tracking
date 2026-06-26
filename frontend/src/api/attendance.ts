import axios from './axios'

export const getAttendance = (sessionId: string) =>
  axios.get(`/sessions/${sessionId}/attendance`)

export const saveAttendance = (sessionId: string, records: unknown[]) =>
  axios.put(`/sessions/${sessionId}/attendance`, { records })
