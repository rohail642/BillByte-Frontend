import client from './client'
export const getOrders       = (params)        => client.get('/orders/', { params })
export const createOrder     = body            => client.post('/orders/', body)
export const getOrder        = id              => client.get(`/orders/${id}`)
export const updateStatus    = (id, status)    => client.patch(`/orders/${id}/status`, { status })
export const collectPayment  = (id, body)      => client.patch(`/orders/${id}/pay`, body)
export const getDashboardSummary = ()          => client.get('/orders/summary')
