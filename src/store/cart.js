import { create } from 'zustand'

export const useCartStore = create((set, get) => ({
  items: [],
  orderType: 'dine_in',
  tableNumber: '',
  customerName: '',
  discountPercent: 0,

  addItem: (item) => set(s => {
    const ex = s.items.find(i => i.id === item.id)
    if (ex) return { items: s.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) }
    return { items: [...s.items, { ...item, qty: 1 }] }
  }),
  removeItem: (id) => set(s => ({
    items: s.items.map(i => i.id === id
      ? i.qty > 1 ? { ...i, qty: i.qty - 1 } : null
      : i
    ).filter(Boolean)
  })),
  deleteItem:     (id) => set(s => ({ items: s.items.filter(i => i.id !== id) })),
  clearCart:      ()   => set({ items: [], discountPercent: 0, customerName: '', tableNumber: '' }),
  setOrderType:   (v)  => set({ orderType: v }),
  setTableNumber: (v)  => set({ tableNumber: v }),
  setCustomerName:(v)  => set({ customerName: v }),
  setDiscount:    (v)  => set({ discountPercent: v }),

  getSubtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
  getGst:      () => Math.round(get().items.reduce((s, i) => s + i.price * i.qty, 0) * 0.05),
  getDiscount: () => Math.round(get().items.reduce((s, i) => s + i.price * i.qty, 0) * get().discountPercent / 100),
  getTotal:    () => {
    const sub = get().items.reduce((s, i) => s + i.price * i.qty, 0)
    const gst = Math.round(sub * 0.05)
    const disc = Math.round(sub * get().discountPercent / 100)
    return sub + gst - disc
  },
}))