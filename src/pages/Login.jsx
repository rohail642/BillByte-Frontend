import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { login } from '../api/auth'
import { useAuthStore } from '../store/auth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import logoText from '../assets/logo-text.png'

export default function Login() {
  const [form, setForm] = useState({})
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loginMut = useMutation({
    mutationFn: () => login({ email: form.email, password: form.password }),
    onSuccess: (data) => { setAuth(data); toast.success(`Welcome back, ${data.name}!`); navigate('/') },
    onError:   (e)    => toast.error(typeof e === 'string' ? e : e?.message || 'Login failed'),
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
        <div className="flex justify-center mb-4">
          <img src={logoText} alt="BillByte" className="w-40 object-contain" style={{ mixBlendMode: 'multiply' }} />
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-border px-6 py-3.5">
            <p className="text-sm font-semibold text-green">Sign In</p>
          </div>

          <div className="p-6">
            <div className="flex flex-col gap-4">
              <Input label="Email" type="email" placeholder="you@restaurant.com" autoComplete="email"
                value={form.email || ''} onChange={e => set('email', e.target.value)} />
              <Input label="Password" type="password" placeholder="••••••••" autoComplete="current-password"
                value={form.password || ''} onChange={e => set('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loginMut.mutate()} />
              {loginMut.isError && (
                <p className="text-red text-xs font-medium text-center -mt-1">
                  {typeof loginMut.error === 'string' ? loginMut.error : loginMut.error?.message || 'Login failed'}
                </p>
              )}
              <Button variant="primary" size="lg" className="w-full mt-1"
                loading={loginMut.isPending} onClick={() => loginMut.mutate()}>
                Sign In →
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-1 text-xs text-muted">
          <p className="font-medium mb-1">Powered by BillByte Restaurant OS</p>
          <p>Need help?</p>
          <a href="mailto:rohail230@gmail.com" className="text-green hover:underline">rohail230@gmail.com</a>
          <div className="flex gap-3">
            <a href="https://wa.me/917892718642" target="_blank" rel="noreferrer" className="text-green hover:underline">+91 78927 18642</a>
            <span className="opacity-40">·</span>
            <a href="https://wa.me/919986180523" target="_blank" rel="noreferrer" className="text-green hover:underline">+91 99861 80523</a>
          </div>
          <div className="flex gap-3 mt-1">
            <a href="#/terms" className="hover:text-text transition-colors">Terms of Service</a>
            <span>·</span>
            <a href="#/privacy" className="hover:text-text transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  )
}
