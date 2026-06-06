import client from './client'
export const getCategories   = ()         => client.get('/menu/categories')
export const createCategory  = body       => client.post('/menu/categories', body)
export const deleteCategory  = id         => client.delete(`/menu/categories/${id}`)
export const getMenuItems    = (params)   => client.get('/menu/items', { params })
export const createMenuItem  = body       => client.post('/menu/items', body)
export const updateMenuItem  = (id, body) => client.patch(`/menu/items/${id}`, body)
export const deleteMenuItem  = id         => client.delete(`/menu/items/${id}`)
export const importMenuFromExcel = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post('/menu/import-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
