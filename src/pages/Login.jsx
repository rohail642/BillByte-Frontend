import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { login, register } from '../api/auth'
import { useAuthStore } from '../store/auth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({})
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loginMut = useMutation({
    mutationFn: () => login({ email: form.email, password: form.password }),
    onSuccess: (data) => { setAuth(data); toast.success(`Welcome back, ${data.name}!`); navigate('/') },
    onError:   (e)    => toast.error(String(e)),
  })

  const regMut = useMutation({
    mutationFn: () => register({ name: form.name, restaurant_name: form.restaurant, email: form.email, phone: form.phone, password: form.password }),
    onSuccess: (data) => { setAuth(data); toast.success('Account created! Welcome 🎉'); navigate('/') },
    onError:   (e)    => toast.error(String(e)),
  })

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-green/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-orange/5" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-4xl text-green tracking-tight">
            Bill<span className="text-orange">Byte</span>
          </h1>
          <p className="text-sm text-text3 mt-1">Restaurant OS — sign in to continue</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {['login','register'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab===t ? 'text-green border-b-2 border-green -mb-px bg-green-dim' : 'text-text3 hover:text-text'}`}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'login' ? (
              <div className="flex flex-col gap-4">
                <Input label="Email" type="email" placeholder="you@restaurant.com" autoComplete="email"
                  value={form.email || ''} onChange={e => set('email', e.target.value)} />
                <Input label="Password" type="password" placeholder="••••••••" autoComplete="current-password"
                  value={form.password || ''} onChange={e => set('password', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loginMut.mutate()} />
                <Button variant="primary" size="lg" className="w-full mt-1"
                  loading={loginMut.isPending} onClick={() => loginMut.mutate()}>
                  Sign In →
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Your Name" placeholder="Rahul Kumar"
                    value={form.name || ''} onChange={e => set('name', e.target.value)} />
                  <Input label="Phone" placeholder="+91 98765 43210"
                    value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                </div>
                <Input label="Restaurant Name" placeholder="Spice Garden"
                  value={form.restaurant || ''} onChange={e => set('restaurant', e.target.value)} />
                <Input label="Email" type="email" placeholder="you@restaurant.com"
                  value={form.email || ''} onChange={e => set('email', e.target.value)} />
                <Input label="Password" type="password" placeholder="Min 8 characters"
                  value={form.password || ''} onChange={e => set('password', e.target.value)} />
                <Button variant="primary" size="lg" className="w-full mt-1"
                  loading={regMut.isPending} onClick={() => regMut.mutate()}>
                  Create Account →
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          14-day free trial · No credit card required
        </p>
      </div>
    </div>
  )
}
