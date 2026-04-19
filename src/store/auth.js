import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      restaurantId: null,
      restaurantName: null,
      phone: null,
      setAuth: (data) => set({
        token: data.access_token,
        user: { id: data.user_id, name: data.name, role: data.role },
        restaurantId: data.restaurant_id,
        restaurantName: data.restaurant_name,
        phone: data.phone,
      }),
      clearAuth: () => set({ token: null, user: null, restaurantId: null, restaurantName: null }),
    }),
    { name: 'bb_auth' }
  )
)