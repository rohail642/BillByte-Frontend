import client from './client'
export const getCustomers    = (params)   => client.get('/customers/', { params })
export const lookupCustomer  = (phone)    => client.get('/customers/lookup', { params: { phone } })
export const createCustomer  = body       => client.post('/customers/', body)
export const getCustomer     = id         => client.get(`/customers/${id}`)
export const updateCustomer  = (id, body) => client.patch(`/customers/${id}`, body)
export const getHistory      = id         => client.get(`/customers/${id}/history`)
export const redeemPoints    = (id, pts)  => client.post(`/customers/${id}/redeem`, { points: pts })