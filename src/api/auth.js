import client from './client'

export const login         = (body) => client.post('/auth/login', body)
export const register      = (body) => client.post('/auth/register', body)
export const getMe         = ()     => client.get('/auth/me')
export const getProfile    = ()     => client.get('/auth/profile')
export const updateProfile = (body) => client.patch('/auth/profile', body)

// Change password (verifies current password)
export const changePassword  = (body) => client.post('/auth/change-password', body)