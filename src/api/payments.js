import client from './client'

export const initiatePayment = (orderId, amount, paymentMode) =>
  client.post('/payments/initiate', { order_id: orderId, amount, payment_mode: paymentMode })

export const pollPaymentStatus = (txnNumber) =>
  client.get(`/payments/${txnNumber}/status`)

export const cancelPayment = (txnNumber) =>
  client.post(`/payments/${txnNumber}/cancel`)
