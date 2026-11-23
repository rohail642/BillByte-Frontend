import client from './client'

// Staff records
export const getStaff         = ()                => client.get('/staff/')
export const createStaff      = body              => client.post('/staff/', body)
export const updateStaff      = (id, body)        => client.patch(`/staff/${id}`, body)
export const deleteStaff      = id                => client.delete(`/staff/${id}`)

// Attendance — dates are 'YYYY-MM-DD' (India date); omitted = today
export const markAttendance   = (id, body)        => client.patch(`/staff/${id}/attendance`, body)
export const clearAttendance  = (id, day)         => client.delete(`/staff/${id}/attendance/${day}`)
export const getAttendance    = (id, month, year) => client.get(`/staff/${id}/attendance`, { params: { month, year } })
export const getDayAttendance = day               => client.get('/staff/attendance/day', { params: day ? { day } : {} })
export const markBulk         = (day, entries)    => client.post('/staff/attendance/bulk', { date: day, entries })
export const getMonthAttendance = (month, year)   => client.get('/staff/attendance/month', { params: { month, year } })

// Advances, salary sheet, payouts
export const getAdvances      = (id, month, year) => client.get(`/staff/${id}/advances`, { params: { month, year } })
export const addAdvance       = (id, body)        => client.post(`/staff/${id}/advances`, body)
export const deleteAdvance    = advId             => client.delete(`/staff/advances/${advId}`)
export const getPayroll       = (month, year)     => client.get('/staff/payroll', { params: { month, year } })
export const markSalaryPaid   = (id, body)        => client.post(`/staff/${id}/payout`, body)
export const undoSalaryPaid   = (id, year, month) => client.delete(`/staff/${id}/payout`, { params: { year, month } })
export const getStaffSettings = ()                => client.get('/staff/settings')
export const saveStaffSettings = body             => client.put('/staff/settings', body)
