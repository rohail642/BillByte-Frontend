import client from './client'
export const getCategories   = ()         => client.get('/menu/categories')
export const createCategory  = body       => client.post('/menu/categories', body)
export const deleteCategory  = id         => client.delete(`/menu/categories/${id}`)
export const getMenuItems    = (params)   => client.get('/menu/items', { params })
export const createMenuItem  = body       => client.post('/menu/items', body)
export const updateMenuItem  = (id, body) => client.patch(`/menu/items/${id}`, body)
export const deleteMenuItem  = id         => client.delete(`/menu/items/${id}`)
export const clearEntireMenu = ()         => client.delete('/menu/all')
export const importMenuFromExcel = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  // Do NOT set Content-Type manually — the browser must add the multipart boundary.
  return client.post('/menu/import-excel', fd)
}
