import client from './client'
export const getStaff         = ()              => client.get('/staff/')
export const createStaff      = body            => client.post('/staff/', body)
export const updateStaff      = (id, body)      => client.patch(`/staff/${id}`, body)
export const markAttendance   = (id, body)      => client.patch(`/staff/${id}/attendance`, body)
export const getAttendance    = (id, month, year) => client.get(`/staff/${id}/attendance`, { params: { month, year } })
export const deleteStaff      = id              => client.delete(`/staff/${id}`)