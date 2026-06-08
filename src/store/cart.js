import { create } from 'zustand'

export const useCartStore = create((set, get) => ({
  items: [],
  orderType: 'takeaway',
  tableNumber: '',
  customerName: '',   // holds the phone number (used for customer lookup/loyalty)
  guestName: '',      // optional display name printed on the KOT (e.g. takeaway customer)
  orderNote: '',      // optional KOT note/description (e.g. "less spicy")
  discountPercent: 0,
  activeOrderId: null,
  gstRate: 5,

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
  clearCart:       ()  => set({ items: [], discountPercent: 0, customerName: '', guestName: '', orderNote: '', tableNumber: '', activeOrderId: null }),
  setOrderType:    (v) => set({ orderType: v }),
  setTableNumber:  (v) => set({ tableNumber: v }),
  setCustomerName: (v) => set({ customerName: v }),
  setGuestName:    (v) => set({ guestName: v }),
  setOrderNote:    (v) => set({ orderNote: v }),
  setDiscount:     (v) => set({ discountPercent: v }),
  setActiveOrderId:(v) => set({ activeOrderId: v }),
  setGstRate:      (v) => set({ gstRate: v }),

  getSubtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
  getGst:      () => Math.round(get().items.reduce((s, i) => s + i.price * i.qty, 0) * get().gstRate / 100),
  getDiscount: () => Math.round(get().items.reduce((s, i) => s + i.price * i.qty, 0) * get().discountPercent / 100),
  roundOff: false,
  setRoundOff: (v) => set({ roundOff: v }),

  getTotal: () => {
    const sub = get().items.reduce((s, i) => s + i.price * i.qty, 0)
    const gst = Math.round(sub * get().gstRate / 100)
    const disc = Math.round(sub * get().discountPercent / 100)
    const raw = sub + gst - disc
    if (!get().roundOff) return raw
    return Math.round(raw / 10) * 10
  },
}))