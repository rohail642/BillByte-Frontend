import client from './client'

export const getAnnouncements = () => client.get('/auth/announcements')
