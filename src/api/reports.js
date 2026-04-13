import client from './client'
export const getSalesReport  = (period) => client.get('/reports/sales', { params: { period } })
export const getTopDishes    = (period) => client.get('/reports/top-dishes', { params: { period, limit: 10 } })
export const getRevenueTrend = (days)   => client.get('/reports/revenue-trend', { params: { days } })
