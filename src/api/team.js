import client from './client'
export const getTeam         = ()         => client.get('/auth/team')
export const addTeamMember   = body       => client.post('/auth/team', body)
export const updateTeamMember = (id, body) => client.patch(`/auth/team/${id}`, body)
export const removeTeamMember = id        => client.delete(`/auth/team/${id}`)