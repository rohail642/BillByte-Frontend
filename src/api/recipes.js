import client from './client'
export const getRecipes   = ()              => client.get('/recipes/')
export const getRecipe    = (menuItemId)    => client.get(`/recipes/${menuItemId}`)
export const saveRecipe   = (body)          => client.post('/recipes/', body)
export const deleteRecipe = (menuItemId)    => client.delete(`/recipes/${menuItemId}`)