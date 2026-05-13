import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMenuItems, getCategories, createMenuItem, updateMenuItem, deleteMenuItem, createCategory, deleteCategory } from '../api/menu'
import { getInventory } from '../api/inventory'
import { getRecipes, saveRecipe, deleteRecipe } from '../api/recipes'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Plus, Pencil, Trash2, Eye, EyeOff, ChefHat, UtensilsCrossed, X, Tags } from 'lucide-react'
import { clsx } from 'clsx'

const TABS = [
  { id: 'items',   label: 'Menu Items', icon: UtensilsCrossed },
  { id: 'recipes', label: 'Recipes',    icon: ChefHat         },
]

export default function Menu() {
  const qc = useQueryClient()
  const [tab,          setTab]         = useState('items')
  const [search,       setSearch]      = useState('')
  const [catFilter,    setCatFilter]   = useState('')
  const [itemModal,    setItemModal]   = useState(null)
  const [recipeModal,  setRecipeModal] = useState(null) // menu item object
  const [catModal,     setCatModal]    = useState(false)
  const [newCatName,   setNewCatName]  = useState('')
  const [form,         setForm]        = useState({})
  const [ingredients,  setIngredients] = useState([]) // [{inventory_item_id, quantity, unit}]
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const { data: items, isLoading } = useQuery({ queryKey: ['menuItems'], queryFn: () => getMenuItems({}) })
  const { data: inventory } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({}) })
  const { data: recipes }   = useQuery({ queryKey: ['recipes'],   queryFn: getRecipes })

  const refetch = () => qc.invalidateQueries({ queryKey: ['menuItems'] })
  const refetchRecipes = () => qc.invalidateQueries({ queryKey: ['recipes'] })

  const createMut  = useMutation({ mutationFn: createMenuItem, onSuccess: () => { toast.success('Item added!');   refetch(); setItemModal(null) }, onError: e => toast.error(String(e)) })
  const updateMut  = useMutation({ mutationFn: ({id,...b}) => updateMenuItem(id,b), onSuccess: () => { toast.success('Item updated!'); refetch(); setItemModal(null) }, onError: e => toast.error(String(e)) })
  const deleteMut  = useMutation({ mutationFn: deleteMenuItem, onSuccess: () => { toast.success('Item deleted!'); refetch() }, onError: e => toast.error(String(e)) })
  const toggleMut  = useMutation({ mutationFn: ({id,active}) => updateMenuItem(id,{is_active:active}), onSuccess: () => refetch(), onError: e => toast.error(String(e)) })
  const recipeMut  = useMutation({
    mutationFn: saveRecipe,
    onSuccess: () => { toast.success('Recipe saved! Inventory will auto-deduct on KOT.'); refetchRecipes(); setRecipeModal(null) },
    onError: e => toast.error(String(e))
  })
  const createCatMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { toast.success('Category created!'); qc.invalidateQueries({ queryKey: ['categories'] }); setNewCatName('') },
    onError: e => toast.error(String(e))
  })
  const deleteCatMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => { toast.success('Category deleted'); qc.invalidateQueries({ queryKey: ['categories'] }) },
    onError: e => toast.error(String(e))
  })

  const deleteRecipeMut = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => { toast.success('Recipe removed.'); refetchRecipes() },
    onError: e => toast.error(String(e))
  })

  const filtered = (items||[]).filter(m =>
    (!catFilter || m.category_id === catFilter) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  )
  const catName = id => (categories||[]).find(c=>c.id===id)?.name || '—'
  const recipeMap = {} // menuItemId → recipe
  ;(recipes||[]).forEach(r => { recipeMap[r.menu_item_id] = r })

  const openAddItem  = () => { setForm({ emoji:'🍽️', food_type:'veg', is_active:true }); setItemModal('add') }
  const openEditItem = (item) => { setForm({...item}); setItemModal(item) }

  const openRecipeModal = (item) => {
    const existing = recipeMap[item.id]
    setIngredients(existing ? existing.ingredients.map(i => ({
      inventory_item_id: i.inventory_item_id,
      name: i.inventory_item_name,
      quantity: i.quantity,
      unit: i.unit,
    })) : [])
    setRecipeModal(item)
  }

  const addIngredient = () => setIngredients(prev => [...prev, { inventory_item_id: '', quantity: '', unit: 'kg' }])
  const removeIngredient = (i) => setIngredients(prev => prev.filter((_,idx) => idx !== i))
  const updateIngredient = (i, key, val) => setIngredients(prev =>
    prev.map((ing, idx) => {
      if (idx !== i) return ing
      if (key === 'inventory_item_id') {
        const invItem = (inventory||[]).find(item => item.id === Number(val))
        return { ...ing, inventory_item_id: Number(val), name: invItem?.name, unit: invItem?.unit || 'kg' }
      }
      return { ...ing, [key]: val }
    })
  )

  const saveRecipeHandler = () => {
    if (!ingredients.length) { toast.error('Add at least one ingredient'); return }
    if (ingredients.some(i => !i.inventory_item_id || !i.quantity)) { toast.error('Fill in all ingredient fields'); return }
    recipeMut.mutate({
      menu_item_id: recipeModal.id,
      ingredients: ingredients.map(i => ({
        inventory_item_id: Number(i.inventory_item_id),
        quantity: Number(i.quantity),
        unit: i.unit,
      }))
    })
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t.id ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}>
            <t.icon size={14} />{t.label}
            {t.id === 'recipes' && (recipes||[]).length > 0 && (
              <span className="ml-1 bg-green text-white text-[10px] font-bold rounded-full px-1.5">{(recipes||[]).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── MENU ITEMS TAB ───────────────────────────────────────────── */}
      {tab === 'items' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input className="flex-1 min-w-48 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-green transition-all"
              placeholder="🔍 Search menu..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex items-center gap-1">
              <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-green cursor-pointer"
                value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">All Categories</option>
                {(categories||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setCatModal(true)} title="Manage categories"
                className="p-2 rounded-lg border border-border bg-surface text-muted hover:text-text hover:bg-surface2 transition-colors">
                <Tags size={15}/>
              </button>
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={openAddItem}>Add Item</Button>
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm text-text">
                Menu Items <span className="text-muted font-normal">({filtered.length})</span>
              </h3>
            </div>
            {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg"/></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    {['Item','Category','Price','Type','Recipe','Status',''].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-muted pb-2 px-2 first:pl-0">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map(item => (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors group">
                        <td className="py-3 px-2 pl-0">
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">{item.emoji}</span>
                            <span className="font-semibold text-text">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-text3">{catName(item.category_id)}</td>
                        <td className="py-3 px-2 font-bold text-green2">₹{item.price}</td>
                        <td className="py-3 px-2">
                          {item.food_type !== 'na' && (
                            <Badge color={item.food_type==='veg'?'green':item.food_type==='vegan'?'blue':'orange'}>
                              {item.food_type.replace('_','-')}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {recipeMap[item.id] ? (
                            <Badge color="green" dot>
                              {recipeMap[item.id].ingredients.length} ingredients
                            </Badge>
                          ) : (
                            <Badge color="gray">No recipe</Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <Badge color={item.is_active?'green':'red'}>{item.is_active?'Active':'Hidden'}</Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openRecipeModal(item)} title="Edit recipe"
                              className="p-1.5 rounded-lg hover:bg-green-dim text-text3 hover:text-green2 transition-colors">
                              <ChefHat size={14}/>
                            </button>
                            <button onClick={() => toggleMut.mutate({id:item.id, active:!item.is_active})}
                              className="p-1.5 rounded-lg hover:bg-surface3 text-text3 hover:text-text transition-colors">
                              {item.is_active ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>
                            <button onClick={() => openEditItem(item)}
                              className="p-1.5 rounded-lg hover:bg-surface3 text-text3 hover:text-text transition-colors">
                              <Pencil size={14}/>
                            </button>
                            <button onClick={() => { if(confirm('Delete this item?')) deleteMut.mutate(item.id) }}
                              className="p-1.5 rounded-lg hover:bg-red-dim text-text3 hover:text-red transition-colors">
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── RECIPES TAB ─────────────────────────────────────────────── */}
      {tab === 'recipes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Set ingredients for each dish. Stock auto-deducts when KOT is sent.
            </p>
          </div>

          {(recipes||[]).length === 0 ? (
            <EmptyState icon="🍳" title="No recipes yet"
              description="Go to Menu Items, hover a dish and click the chef hat icon to add its recipe"
              action={<Button variant="secondary" size="sm" onClick={() => setTab('items')}>Go to Menu Items →</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(recipes||[]).map(recipe => {
                const menuItem = (items||[]).find(m => m.id === recipe.menu_item_id)
                return (
                  <Card key={recipe.id} hover>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{menuItem?.emoji || '🍽️'}</span>
                        <div>
                          <p className="font-display font-bold text-sm text-text">{recipe.menu_item_name}</p>
                          <p className="text-[11px] text-muted">{recipe.ingredients.length} ingredients</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openRecipeModal(menuItem || { id: recipe.menu_item_id, name: recipe.menu_item_name })}
                          className="p-1.5 rounded-lg hover:bg-surface2 text-text3 hover:text-text transition-colors">
                          <Pencil size={13}/>
                        </button>
                        <button onClick={() => { if(confirm('Remove this recipe?')) deleteRecipeMut.mutate(recipe.menu_item_id) }}
                          className="p-1.5 rounded-lg hover:bg-red-dim text-text3 hover:text-red transition-colors">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {recipe.ingredients.map(ing => (
                        <div key={ing.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                          <span className="text-text2 font-medium">{ing.inventory_item_name}</span>
                          <span className="font-bold text-text">{ing.quantity} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MANAGE CATEGORIES MODAL ─────────────────────────────────── */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setNewCatName('') }} title="🏷️ Manage Categories">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-green transition-all"
              placeholder="New category name…"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) createCatMut.mutate({ name: newCatName.trim() }) }}
            />
            <Button variant="primary" size="sm" icon={<Plus size={14}/>}
              loading={createCatMut.isPending}
              onClick={() => { if (newCatName.trim()) createCatMut.mutate({ name: newCatName.trim() }) }}>
              Add
            </Button>
          </div>
          {(categories||[]).length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No categories yet. Add one above.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {(categories||[]).map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface2">
                  <span className="text-sm font-medium text-text">{c.name}</span>
                  <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteCatMut.mutate(c.id) }}
                    className="p-1 rounded hover:bg-red-dim text-muted hover:text-red transition-colors">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── ADD/EDIT ITEM MODAL ──────────────────────────────────────── */}
      <Modal open={!!itemModal} onClose={() => setItemModal(null)}
        title={itemModal === 'add' ? '✚ Add Menu Item' : '✏️ Edit Item'}
        footer={<>
          <Button variant="secondary" onClick={() => setItemModal(null)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending||updateMut.isPending}
            onClick={() => {
              if (!form.name || !form.price) { toast.error('Name and price required'); return }
              if (itemModal === 'add') createMut.mutate({ name:form.name, price:Number(form.price), emoji:form.emoji, food_type:form.food_type, category_id:form.category_id||null, is_active:true })
              else updateMut.mutate({ id:itemModal.id, name:form.name, price:Number(form.price), emoji:form.emoji, food_type:form.food_type, category_id:form.category_id||null })
            }}>
            {itemModal === 'add' ? 'Add Item' : 'Save Changes'}
          </Button>
        </>}>
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <Input label="Emoji" value={form.emoji||''} onChange={e=>set('emoji',e.target.value)} maxLength={2} className="text-center text-xl" />
            <div className="col-span-3"><Input label="Item Name" placeholder="e.g. Butter Chicken" value={form.name||''} onChange={e=>set('name',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Price (₹)" type="number" placeholder="280" value={form.price||''} onChange={e=>set('price',e.target.value)} />
            <Select label="Type" value={form.food_type||'veg'} onChange={e=>set('food_type',e.target.value)}>
              <option value="veg">Veg</option>
              <option value="non_veg">Non-Veg</option>
              <option value="vegan">Vegan</option>
              <option value="na">N/A</option>
            </Select>
          </div>
          <Select label="Category" value={form.category_id||''} onChange={e=>set('category_id',Number(e.target.value)||null)}>
            <option value="">No category</option>
            {(categories||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </Modal>

      {/* ── RECIPE MODAL ─────────────────────────────────────────────── */}
      <Modal open={!!recipeModal} onClose={() => setRecipeModal(null)} size="lg"
        title={`🍳 Recipe — ${recipeModal?.emoji || ''} ${recipeModal?.name || ''}`}
        footer={<>
          <Button variant="secondary" onClick={() => setRecipeModal(null)}>Cancel</Button>
          <Button variant="primary" loading={recipeMut.isPending} onClick={saveRecipeHandler}>
            Save Recipe
          </Button>
        </>}>
        <div className="space-y-4">
          <div className="bg-green-dim border border-green/20 rounded-lg px-3 py-2.5 text-xs text-green2">
            💡 When a KOT is sent for this dish, these quantities will be automatically deducted from your inventory.
          </div>

          {/* Ingredient rows */}
          <div className="space-y-2">
            {ingredients.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No ingredients yet — add one below</p>
            )}
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  {i === 0 && <label className="text-xs font-semibold text-text2 mb-1 block">Ingredient</label>}
                  <select
                    className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm outline-none focus:border-green cursor-pointer"
                    value={ing.inventory_item_id || ''}
                    onChange={e => updateIngredient(i, 'inventory_item_id', e.target.value)}>
                    <option value="">Select ingredient</option>
                    {(inventory||[]).map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit} in stock)</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 90 }}>
                  {i === 0 && <label className="text-xs font-semibold text-text2 mb-1 block">Qty</label>}
                  <input type="number" step="0.01" placeholder="0"
                    className="w-full bg-bg border border-border2 rounded-lg px-2 py-2 text-sm outline-none focus:border-green"
                    value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} />
                </div>
                <div style={{ width: 80 }}>
                  {i === 0 && <label className="text-xs font-semibold text-text2 mb-1 block">Unit</label>}
                  <select
                    className="w-full bg-bg border border-border2 rounded-lg px-2 py-2 text-sm outline-none focus:border-green cursor-pointer"
                    value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}>
                    {['kg','g','L','ml','pcs'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <button onClick={() => removeIngredient(i)}
                  className="p-2 rounded-lg hover:bg-red-dim text-muted hover:text-red transition-colors flex-shrink-0 mb-0.5">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>

          <Button variant="secondary" size="sm" icon={<Plus size={13}/>} onClick={addIngredient}>
            Add Ingredient
          </Button>
        </div>
      </Modal>
    </div>
  )
}