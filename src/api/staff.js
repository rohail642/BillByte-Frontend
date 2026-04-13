import client from './client'
export const getStaff    = ()         => client.get('/staff/')
export const createStaff = body       => client.post('/staff/', body)
export const updateStaff = (id, body) => client.patch(`/staff/${id}`, body)
export const deleteStaff = id         => client.delete(`/staff/${id}`)
