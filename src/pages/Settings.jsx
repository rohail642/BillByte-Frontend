import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile, changePassword } from '../api/auth'
import { getCategories } from '../api/menu'
import { API_URL } from '../api/client'
import { getTeam, addTeamMember, updateTeamMember, removeTeamMember } from '../api/team'
import { useAuthStore } from '../store/auth'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Toggle from '../components/ui/Toggle'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { getNotifPrefs, setNotifPref } from '../utils/notifPrefs'
import { Store, Receipt, Link2, Bell, FileText, Users, Plus, Trash2, Pencil, UtensilsCrossed, ShieldCheck, Check, Printer, KeyRound, X } from 'lucide-react'
import { clsx } from 'clsx'

const SECTION_COLORS = [
  { id: 'blue',   hex: '#3b82f6' },
  { id: 'orange', hex: '#ea580c' },
  { id: 'green',  hex: '#16a34a' },
  { id: 'purple', hex: '#9333ea' },
  { id: 'teal',   hex: '#0d9488' },
  { id: 'red',    hex: '#dc2626' },
  { id: 'gray',   hex: '#78716c' },
]

const SECTIONS = [
  { id: 'restaurant',    label: 'Restaurant',    icon: Store           },
  { id: 'billing',       label: 'Billing',       icon: Receipt         },
  { id: 'tables',        label: 'Tables',        icon: UtensilsCrossed },
  { id: 'integrations',  label: 'Integrations',  icon: Link2           },
  { id: 'notifications', label: 'Notifications', icon: Bell            },
  { id: 'gst',           label: 'GST / Tax',     icon: FileText        },
  { id: 'printers',      label: 'Printers',       icon: Printer         },
  { id: 'team',          label: 'Team Access',   icon: Users           },
  { id: 'security',      label: 'Security',      icon: KeyRound        },
  { id: 'license',       label: 'License',       icon: ShieldCheck     },
]

const PLAN_META = {
  trial:   { label: 'Trial',   color: 'amber'  },
  starter: { label: 'Starter', color: 'blue'   },
  pro:     { label: 'Pro',     color: 'green'  },
  custom:  { label: 'Custom',  color: 'purple' },
}

const PLAN_FEATURES = {
  trial: [
    'Billing & KOT',
    'Table management',
    'Dine-in, takeaway & delivery orders',
    'Online orders (Zomato & Swiggy)',
    'Basic reports',
    'Staff roles (Owner, Cashier)',
    'Works on any device — phone, tablet, or laptop',
  ],
  starter: [
    'Billing & KOT',
    'Table management',
    'Dine-in, takeaway & delivery orders',
    'Online orders (Zomato & Swiggy)',
    'Basic reports',
    'Staff roles (Owner, Cashier)',
    'Works on any device — phone, tablet, or laptop',
  ],
  pro: [
    'Everything in Starter',
    'Inventory management & stock alerts',
    'CRM & customer loyalty points',
    'Staff roles (Owner, Cashier, Waiter, Kitchen)',
    'Kitchen Display System',
    'Advanced reports & CSV exports',
    'Windows desktop app',
    'PWA — works on any mobile device',
    'Waiter app — table-side ordering & live KOT',
  ],
  custom: null,
}

export default function Settings() {
  const [active, setActive] = useState('restaurant')
  const qc = useQueryClient()

  const [toggles, setToggles] = useState(() => {
    const p = getNotifPrefs()
    return { roundOff: false, loyalty: true, showGst: true, orderAlert: p.orderAlert, lowStock: p.lowStock, dailySummary: p.dailySummary }
  })

  const [printers, setPrinters]           = useState([{ name: '', type: 'network', ip: '', usbName: '', categories: [] }])
  const [billPrinter, setBillPrinter]     = useState({ name: '', type: 'network', ip: '', usbName: '' })
  const [savingPrinters, setSavingPrinters] = useState(false)
  const [systemPrinters, setSystemPrinters] = useState([])

  useEffect(() => {
    if (!window.electronAPI?.getPrinterConfig) return
    window.electronAPI.getPrinterConfig().then(config => {
      if (config?.printers?.length)
        setPrinters(config.printers.map(p => ({ name: p.name || '', type: p.type || 'network', ip: p.ip || '', usbName: p.usbName || '', categories: Array.isArray(p.categories) ? p.categories : [] })))
      if (config?.billPrinter) {
        const bp = config.billPrinter
        setBillPrinter({ name: bp.name || '', type: bp.type || 'network', ip: bp.ip || '', usbName: bp.usbName || '' })
      }
    })
    window.electronAPI.getSystemPrinters?.().then(names => setSystemPrinters(names || []))
  }, [])

  async function savePrinters() {
    if (!window.electronAPI?.savePrinterConfig) return
    setSavingPrinters(true)
    try {
      await window.electronAPI.savePrinterConfig({ printers, billPrinter })
      toast.success('Printer settings saved!')
    } catch {
      toast.error('Failed to save printer settings')
    } finally {
      setSavingPrinters(false)
    }
  }

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  })

  // Menu categories for KOT printer routing (desktop only)
  const { data: menuCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: !!window.electronAPI?.isElectron,
  })

  const togglePrinterCategory = (i, catId) =>
    setPrinters(p => p.map((pr, j) => {
      if (j !== i) return pr
      const cats = Array.isArray(pr.categories) ? pr.categories : []
      return { ...pr, categories: cats.includes(catId) ? cats.filter(c => c !== catId) : [...cats, catId] }
    }))

  const baseForm = useMemo(() => profile ? {
    name:                profile.name                || '',
    phone:               profile.phone               || '',
    restaurant_name:     profile.restaurant_name     || '',
    address:             profile.address             || '',
    city:                profile.city                || '',
    gstin:               profile.gstin               || '',
    fssai:               profile.fssai               || '',
    gst_rate:            profile.gst_rate            ?? 5,
    table_count:         profile.table_count         ?? 10,
    table_sections:      profile.table_sections      || [],
    zomato_enabled:      profile.zomato_enabled      || false,
    zomato_restaurant_id:profile.zomato_restaurant_id|| '',
    zomato_secret:       '',
    swiggy_enabled:      profile.swiggy_enabled      || false,
    swiggy_restaurant_id:profile.swiggy_restaurant_id|| '',
    swiggy_secret:       '',
    razorpay_enabled:    profile.razorpay_enabled    || false,
    razorpay_key_id:     profile.razorpay_key_id     || '',
    razorpay_key_secret: '',
    pinelabs_enabled:        profile.pinelabs_enabled        || false,
    pinelabs_merchant_id:    profile.pinelabs_merchant_id    || '',
    pinelabs_terminal_id:    profile.pinelabs_terminal_id    || '',
    pinelabs_security_token: '',
  } : {}, [profile])

  const [overrides, setOverrides] = useState({})
  const form = { ...baseForm, ...overrides }
  const set = (k, v) => setOverrides(f => ({ ...f, [k]: v }))

  const [colorPickerOpen, setColorPickerOpen] = useState(null)

  function addSection() {
    setOverrides(o => {
      const prev = o.table_sections ?? baseForm.table_sections ?? []
      return {
        ...o,
        table_sections: [...prev, {
          id: Date.now().toString(),
          name: '',
          color: SECTION_COLORS[prev.length % SECTION_COLORS.length].id,
          tables: [],
        }],
      }
    })
  }
  function removeSection(id) {
    setOverrides(o => ({
      ...o,
      table_sections: (o.table_sections ?? baseForm.table_sections ?? []).filter(s => s.id !== id),
    }))
  }
  function updateSection(id, key, val) {
    setOverrides(o => ({
      ...o,
      table_sections: (o.table_sections ?? baseForm.table_sections ?? []).map(s => s.id === id ? { ...s, [key]: val } : s),
    }))
  }
  // Per-section "add table" input boxes
  const [tblInput, setTblInput] = useState({})

  // "T1, T2" -> ['T1','T2'];  "T1-10" -> ['T1'..'T10'];  "5" -> ['5']
  function expandTableNames(raw) {
    const out = []
    for (let tok of String(raw).split(',')) {
      tok = tok.trim()
      if (!tok) continue
      const m = tok.match(/^(.*?)(\d+)\s*-\s*(\d+)$/)
      if (m) {
        const prefix = m[1]
        const start = parseInt(m[2], 10)
        const end = parseInt(m[3], 10)
        if (start <= end && end - start <= 200) {
          for (let i = start; i <= end; i++) out.push(`${prefix}${i}`)
          continue
        }
      }
      out.push(tok)
    }
    return out
  }

  function addTablesToSection(sectionId, raw) {
    const names = expandTableNames(raw)
    if (names.length === 0) return
    setOverrides(o => {
      const secs = (o.table_sections ?? baseForm.table_sections ?? [])
      const usedElsewhere = new Set(
        secs.filter(s => s.id !== sectionId).flatMap(s => (s.tables || []).map(String))
      )
      let skipped = 0
      const next = secs.map(s => {
        if (s.id !== sectionId) return s
        const existing = (s.tables || []).map(String)
        const have = new Set(existing)
        const added = []
        for (const n of names) {
          if (have.has(n) || usedElsewhere.has(n)) { skipped++; continue }
          have.add(n); added.push(n)
        }
        return { ...s, tables: [...existing, ...added] }
      })
      if (skipped) toast.error(`${skipped} table name(s) skipped — already in use`)
      return { ...o, table_sections: next }
    })
    setTblInput(t => ({ ...t, [sectionId]: '' }))
  }

  function removeTableFromSection(sectionId, name) {
    setOverrides(o => ({
      ...o,
      table_sections: (o.table_sections ?? baseForm.table_sections ?? []).map(s =>
        s.id === sectionId ? { ...s, tables: (s.tables || []).filter(t => String(t) !== String(name)) } : s
      ),
    }))
  }

  const saveTablesMut = useMutation({
    mutationFn: () => {
      const sections = form.table_sections || []
      const total = sections.reduce((n, s) => n + (s.tables || []).length, 0)
      return updateProfile({ table_count: total || form.table_count, table_sections: sections })
    },
    onSuccess: () => {
      toast.success('Table settings saved!')
      setOverrides(o => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'table_count' && k !== 'table_sections')))
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: e => toast.error(String(e)),
  })

  const saveMut = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      toast.success('Settings saved!')
      setOverrides({})
      qc.invalidateQueries({ queryKey: ['profile'] })
      useAuthStore.setState(s => ({
        user: { ...s.user, name: data.name },
        restaurantName: data.restaurant_name,
      }))
    },
    onError: (e) => toast.error(String(e)),
  })

  const saveGst = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => { toast.success('GST settings saved!'); setOverrides({}); qc.setQueryData(['profile'], data) },
    onError: (e) => toast.error(String(e)),
  })

  // Sync billing toggles from profile once loaded — must be after profile + saveMut
  useEffect(() => {
    if (!profile) return
    setToggles(t => ({
      ...t,
      roundOff: profile.round_off ?? false,
      loyalty:  profile.loyalty_enabled ?? true,
      showGst:  profile.show_gst_breakup ?? true,
    }))
  }, [profile])

  const toggle = (k) => {
    const newVal = !toggles[k]
    setToggles(t => ({ ...t, [k]: newVal }))
    const keyMap = { roundOff: 'round_off', loyalty: 'loyalty_enabled', showGst: 'show_gst_breakup' }
    if (keyMap[k]) saveMut.mutate({ [keyMap[k]]: newVal })
    else setNotifPref(k, newVal)
  }

  const { user } = useAuthStore()
  const isOwner = user?.role === 'owner'
  const [teamModal, setTeamModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [teamForm, setTeamForm] = useState({})
  const setTF = (k, v) => setTeamForm(f => ({ ...f, [k]: v }))

  const { data: team, refetch: refetchTeam } = useQuery({
    queryKey: ['team'],
    queryFn: getTeam,
    enabled: isOwner,
  })

  const addMut = useMutation({
    mutationFn: addTeamMember,
    onSuccess: () => { toast.success('Team member added!'); refetchTeam(); setTeamModal(false); setTeamForm({}) },
    onError: e => toast.error(e?.response?.data?.detail || String(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }) => updateTeamMember(id, body),
    onSuccess: () => { toast.success('Updated!'); refetchTeam(); setEditMember(null) },
    onError: e => toast.error(String(e)),
  })

  const removeMut = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => { toast.success('Removed!'); refetchTeam() },
    onError: e => toast.error(String(e)),
  })

  // Change password
  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const setPW = (k, v) => setPwForm(f => ({ ...f, [k]: v }))

  async function handleChangePassword() {
    if (!pwForm.current)                        { toast.error('Enter your current password'); return }
    if (!pwForm.next || pwForm.next.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (pwForm.next !== pwForm.confirm)         { toast.error('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await changePassword({ current_password: pwForm.current, new_password: pwForm.next })
      toast.success('Password changed successfully')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e) { toast.error(String(e)) }
    finally { setPwSaving(false) }
  }

  const ROLE_COLORS = { owner: 'purple', cashier: 'green', waiter: 'gray', kitchen: 'orange' }
  const ROLE_ACCESS_LABELS = {
    cashier: 'Billing, Orders, CRM only',
    waiter:  'Billing and Orders only',
    kitchen: 'Kitchen Display only',
  }

  const content = {
    restaurant: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Restaurant Profile</h3>
        {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : (
          <Card className="space-y-3">
            <div className="bg-amber-dim border border-amber/20 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-amber">Restaurant name, owner name, address and city can only be changed by the BillByte admin.</p>
            </div>
            <Input label="Restaurant Name" value={form.restaurant_name || ''} disabled />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Owner Name" value={form.name || ''} disabled />
              <Input label="Phone" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <Input label="Address" value={form.address || ''} disabled />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="City" value={form.city || ''} disabled />
              <Input label="FSSAI No." value={form.fssai || ''} onChange={e => set('fssai', e.target.value)} placeholder="Enter FSSAI number" />
            </div>
            <Button variant="primary" size="sm" loading={saveMut.isPending}
              onClick={() => saveMut.mutate({ phone: form.phone, fssai: form.fssai })}>
              Save Changes
            </Button>
          </Card>
        )}
      </div>
    ),
    billing: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Billing Settings</h3>
        <Card className="space-y-2.5">
          <Toggle checked={toggles.roundOff}  onChange={() => toggle('roundOff')}  label="Round-off bill amount"     description="Round to nearest ₹10" />
          <Toggle checked={toggles.loyalty}   onChange={() => toggle('loyalty')}   label="Loyalty points on dine-in" description="1 point per ₹10 spent" />
        </Card>
      </div>
    ),
    integrations: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Integrations</h3>
        <p className="text-xs text-muted">Configure your delivery platform integrations. Each restaurant gets a unique webhook URL.</p>

        {/* Zomato */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔴</span>
              <div>
                <p className="text-sm font-bold text-text">Zomato</p>
                <p className="text-xs text-muted">Receive orders automatically from Zomato</p>
              </div>
            </div>
            <button
              role="switch" aria-checked={form.zomato_enabled || false}
              onClick={() => set('zomato_enabled', !form.zomato_enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${form.zomato_enabled ? 'bg-green' : 'bg-border2'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.zomato_enabled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>
          {form.zomato_enabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Input label="Zomato Restaurant ID" placeholder="ZOM-884921"
                value={form.zomato_restaurant_id || ''} onChange={e => set('zomato_restaurant_id', e.target.value)} />
              <Input label="Webhook Secret (from Zomato dashboard)" placeholder="zom_secret_xxxxx"
                value={form.zomato_secret || ''} onChange={e => set('zomato_secret', e.target.value)} />
              {profile?.restaurant_id && (
                <div className="bg-surface2 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted mb-1 font-bold uppercase tracking-wide">Your Webhook URL — give this to Zomato:</p>
                  <code className="text-xs text-green2 break-all">{API_URL}/webhooks/zomato/{profile.restaurant_id}</code>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Swiggy */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟠</span>
              <div>
                <p className="text-sm font-bold text-text">Swiggy</p>
                <p className="text-xs text-muted">Receive orders automatically from Swiggy</p>
              </div>
            </div>
            <button
              role="switch" aria-checked={form.swiggy_enabled || false}
              onClick={() => set('swiggy_enabled', !form.swiggy_enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${form.swiggy_enabled ? 'bg-green' : 'bg-border2'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.swiggy_enabled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>
          {form.swiggy_enabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Input label="Swiggy Restaurant ID" placeholder="SWG-334401"
                value={form.swiggy_restaurant_id || ''} onChange={e => set('swiggy_restaurant_id', e.target.value)} />
              <Input label="Webhook Secret (from Swiggy dashboard)" placeholder="swg_secret_xxxxx"
                value={form.swiggy_secret || ''} onChange={e => set('swiggy_secret', e.target.value)} />
              {profile?.restaurant_id && (
                <div className="bg-surface2 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted mb-1 font-bold uppercase tracking-wide">Your Webhook URL — give this to Swiggy:</p>
                  <code className="text-xs text-green2 break-all">{API_URL}/webhooks/swiggy/{profile.restaurant_id}</code>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Razorpay */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💳</span>
              <div>
                <p className="text-sm font-bold text-text">Razorpay</p>
                <p className="text-xs text-muted">Accept UPI / card payments via Razorpay</p>
              </div>
            </div>
            <button
              role="switch" aria-checked={form.razorpay_enabled || false}
              onClick={() => set('razorpay_enabled', !form.razorpay_enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${form.razorpay_enabled ? 'bg-green' : 'bg-border2'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.razorpay_enabled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>
          {form.razorpay_enabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Input label="Razorpay Key ID" placeholder="rzp_live_xxxxxxxx"
                value={form.razorpay_key_id || ''} onChange={e => set('razorpay_key_id', e.target.value)} />
              <Input label="Razorpay Key Secret" type="password" placeholder="Enter key secret"
                value={form.razorpay_key_secret || ''} onChange={e => set('razorpay_key_secret', e.target.value)} />
            </div>
          )}
        </Card>

        {/* Pine Labs */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🖥️</span>
              <div>
                <p className="text-sm font-bold text-text">Pine Labs Terminal</p>
                <p className="text-xs text-muted">Card & UPI payments via Pine Labs Plutus</p>
              </div>
            </div>
            <button
              role="switch" aria-checked={form.pinelabs_enabled || false}
              onClick={() => set('pinelabs_enabled', !form.pinelabs_enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${form.pinelabs_enabled ? 'bg-green' : 'bg-border2'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.pinelabs_enabled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>
          {form.pinelabs_enabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="bg-blue-dim rounded-lg p-2.5">
                <p className="text-[10px] font-bold text-blue uppercase tracking-wide mb-0.5">How to get these credentials</p>
                <p className="text-xs text-muted">Call Pine Labs merchant support and ask them to enable <strong>Plutus Smart API</strong> on your terminal. They will provide Merchant ID, Terminal ID, and Security Token.</p>
              </div>
              <Input label="Merchant ID" placeholder="e.g. 123456" autoComplete="off"
                value={form.pinelabs_merchant_id || ''} onChange={e => set('pinelabs_merchant_id', e.target.value)} />
              <Input label="Terminal ID" placeholder="e.g. 22334455" autoComplete="off"
                value={form.pinelabs_terminal_id || ''} onChange={e => set('pinelabs_terminal_id', e.target.value)} />
              <Input label="Security Token" type="password" placeholder="Provided by Pine Labs" autoComplete="new-password"
                value={form.pinelabs_security_token || ''} onChange={e => set('pinelabs_security_token', e.target.value)} />
              {profile?.pinelabs_merchant_id && (
                <div className="flex items-center gap-1.5 text-xs text-green2 font-semibold">
                  <span>✅</span> Terminal credentials saved
                </div>
              )}
            </div>
          )}
        </Card>


<Button variant="primary" size="sm" loading={saveMut.isPending}
          onClick={() => saveMut.mutate({
            zomato_enabled: form.zomato_enabled,
            ...(form.zomato_secret ? { zomato_secret: form.zomato_secret } : {}),
            zomato_restaurant_id: form.zomato_restaurant_id,
            swiggy_enabled: form.swiggy_enabled,
            ...(form.swiggy_secret ? { swiggy_secret: form.swiggy_secret } : {}),
            swiggy_restaurant_id: form.swiggy_restaurant_id,
            razorpay_enabled: form.razorpay_enabled,
            razorpay_key_id: form.razorpay_key_id,
            ...(form.razorpay_key_secret ? { razorpay_key_secret: form.razorpay_key_secret } : {}),
            pinelabs_enabled: form.pinelabs_enabled,
            pinelabs_merchant_id: form.pinelabs_merchant_id,
            pinelabs_terminal_id: form.pinelabs_terminal_id,
            ...(form.pinelabs_security_token ? { pinelabs_security_token: form.pinelabs_security_token } : {}),
          })}>
          Save Integrations
        </Button>
      </div>
    ),
    notifications: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Notifications</h3>
        <Card className="space-y-2.5">
          <Toggle checked={toggles.orderAlert}   onChange={() => toggle('orderAlert')}   label="New online order alert" description="Sound + popup for Zomato/Swiggy" />
          <Toggle checked={toggles.lowStock}     onChange={() => toggle('lowStock')}     label="Low stock alerts"       description="Notify when item drops below min qty" />
          <Toggle checked={toggles.dailySummary} onChange={() => toggle('dailySummary')} label="Daily sales summary"    description="WhatsApp report at 11 PM" />
        </Card>
      </div>
    ),
    gst: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">GST & Tax</h3>
        {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : (
          <Card className="space-y-3">
            <Input label="GSTIN" value={form.gstin || ''} onChange={e => set('gstin', e.target.value)} placeholder="29AABCT1332L1ZN" />
            <div>
              <Input label="GST Rate % (applies to all orders)" type="number" value={form.gst_rate ?? 5} onChange={e => set('gst_rate', Number(e.target.value))} />
              <p className="text-xs text-muted mt-1">
                CGST {((form.gst_rate ?? 5) / 2).toFixed(1)}% + SGST {((form.gst_rate ?? 5) / 2).toFixed(1)}% — applied to dine-in, takeaway & delivery
              </p>
            </div>
            <Toggle checked={toggles.showGst} onChange={() => toggle('showGst')} label="Show GST breakup on bill" />
            <Button variant="primary" size="sm" loading={saveGst.isPending}
              onClick={() => saveGst.mutate({ gstin: form.gstin, gst_rate: form.gst_rate })}>
              Save
            </Button>
          </Card>
        )}
      </div>
    ),
    tables: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Table Management</h3>

        <div className="bg-blue-dim rounded-lg px-3 py-2">
          <p className="text-xs text-text2">
            Group tables into zones (Main Hall, Lawn, First Floor…) and give each table any name you want —
            <span className="font-semibold text-text"> T1, L1, F1</span>, etc. Each zone names its own tables, so they don't have to run in one sequence.
          </p>
        </div>

        {/* Sections */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-text">Sections</p>
            <p className="text-[10px] text-muted mt-0.5">Add a zone, then add its tables by name.</p>
          </div>
          <Button variant="secondary" size="sm" icon={<Plus size={13}/>} onClick={addSection}>
            Add Section
          </Button>
        </div>

        {(form.table_sections || []).length === 0 && (
          <Card className="text-center py-6">
            <UtensilsCrossed size={24} className="text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">No sections yet.</p>
            <p className="text-xs text-muted mt-0.5">Add a section (e.g. Main Hall) to start naming tables.</p>
          </Card>
        )}

        {(form.table_sections || []).map((section) => {
          const colorHex = SECTION_COLORS.find(c => c.id === section.color)?.hex || '#78716c'
          const tables = (section.tables || []).map(String)
          return (
            <Card key={section.id} className="space-y-3">
              <div className="flex items-center gap-2">
                {/* Color picker */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setColorPickerOpen(colorPickerOpen === section.id ? null : section.id)}
                    className="w-6 h-6 rounded-full border-2 border-white shadow"
                    style={{ background: colorHex }}
                  />
                  {colorPickerOpen === section.id && (
                    <div className="absolute top-8 left-0 z-20 bg-bg2 border border-border rounded-xl p-2 shadow-lg flex flex-wrap gap-1.5 w-36">
                      {SECTION_COLORS.map(c => (
                        <button key={c.id}
                          onClick={() => { updateSection(section.id, 'color', c.id); setColorPickerOpen(null) }}
                          className={clsx('w-6 h-6 rounded-full border-2 transition-all',
                            section.color === c.id ? 'border-text scale-110' : 'border-transparent hover:scale-110')}
                          style={{ background: c.hex }} />
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="flex-1 bg-bg border border-border2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green transition-colors font-semibold"
                  placeholder="Section name (e.g. Main Hall, Lawn, First Floor…)"
                  value={section.name}
                  onChange={e => updateSection(section.id, 'name', e.target.value)}
                />
                <span className="text-[10px] text-muted flex-shrink-0">{tables.length} tables</span>
                <button onClick={() => removeSection(section.id)}
                  className="text-muted hover:text-red transition-colors p-1 rounded flex-shrink-0">
                  <Trash2 size={14}/>
                </button>
              </div>

              {/* Named tables */}
              <div className="space-y-2">
                {tables.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tables.map(name => (
                      <span key={name}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: colorHex }}>
                        {name}
                        <button onClick={() => removeTableFromSection(section.id, name)}
                          className="hover:bg-black/20 rounded p-0.5 transition-colors" title="Remove table">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">No tables yet — add some below.</p>
                )}

                <div className="flex gap-1.5">
                  <input
                    className="flex-1 bg-bg border border-border2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green transition-colors"
                    placeholder="Add tables — e.g. T1, T2  or  T1-10"
                    value={tblInput[section.id] || ''}
                    onChange={e => setTblInput(t => ({ ...t, [section.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTablesToSection(section.id, tblInput[section.id] || '') } }}
                  />
                  <Button variant="secondary" size="sm"
                    onClick={() => addTablesToSection(section.id, tblInput[section.id] || '')}>
                    Add
                  </Button>
                </div>
                <p className="text-[10px] text-muted">
                  Type a name and press Enter. Add many at once with commas (<b>T1, T2</b>) or a range (<b>T1-10</b> → T1…T10).
                </p>
              </div>
            </Card>
          )
        })}

        <Button variant="primary" size="sm" loading={saveTablesMut.isPending}
          onClick={() => saveTablesMut.mutate()}>
          Save Table Settings
        </Button>
      </div>
    ),
    license: (() => {
      const plan      = profile?.plan || 'trial'
      const meta      = PLAN_META[plan] || PLAN_META.trial
      const daysLeft  = profile?.days_left ?? null
      const expiresAt = profile?.trial_ends_at
        ? new Date(profile.trial_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        : null

      let urgencyColor = 'text-green2'
      let urgencyBg    = 'bg-green-dim'
      if (daysLeft !== null && daysLeft <= 7)  { urgencyColor = 'text-red';    urgencyBg = 'bg-red-dim'   }
      else if (daysLeft !== null && daysLeft <= 30) { urgencyColor = 'text-amber';  urgencyBg = 'bg-amber-dim' }

      return (
        <div className="space-y-4">
          <h3 className="font-display font-bold text-sm text-text">License & Plan</h3>

          {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : (
            <>
              <Card className="space-y-4">
                {/* Plan row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Current Plan</p>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} className="text-green2" />
                      <span className="font-display font-bold text-xl text-text capitalize">{meta.label}</span>
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </div>
                  </div>
                  <Badge color={profile?.is_active !== false ? 'green' : 'red'}>
                    {profile?.is_active !== false ? 'Active' : 'Suspended'}
                  </Badge>
                </div>

                <div className="border-t border-border" />

                {/* Expiry */}
                {expiresAt ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">
                        License Expiry
                      </p>
                      <p className="text-sm font-semibold text-text">{expiresAt}</p>
                    </div>
                    {daysLeft !== null && (
                      <div className={`px-3 py-1.5 rounded-lg ${urgencyBg}`}>
                        <p className={`text-xs font-bold ${urgencyColor}`}>
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No expiry date set.</p>
                )}

                {/* Urgency banner */}
                {daysLeft !== null && daysLeft <= 7 && (
                  <div className="bg-red-dim border border-red/20 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-red">
                      {daysLeft <= 0
                        ? 'Your license has expired. Contact BillByte to restore access.'
                        : `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left — contact BillByte to renew before access is lost.`}
                    </p>
                  </div>
                )}
              </Card>

              {/* What's included */}
              {PLAN_FEATURES[plan] && (
                <Card className="space-y-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">What's included</p>
                  <ul className="space-y-2">
                    {PLAN_FEATURES[plan].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-text">
                        <Check size={14} className="text-green2 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Contact to upgrade */}
              <Card className="space-y-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Upgrade or Renew</p>
                <p className="text-sm text-text3 leading-relaxed">
                  To upgrade your plan or renew your license, get in touch with the BillByte team directly.
                </p>
                <a
                  href="https://wa.me/917892718642?text=Hi%2C%20I%20want%20to%20upgrade%20my%20BillByte%20plan"
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-green text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-green2 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Contact BillByte on WhatsApp
                </a>
              </Card>
            </>
          )}
        </div>
      )
    })(),

    printers: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">KOT Printers</h3>
        {!window.electronAPI?.isElectron ? (
          <Card>
            <p className="text-sm text-muted text-center py-6">KOT printer configuration is only available in the desktop app.</p>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted">Add up to 3 thermal printers for KOT. Assign menu categories to route items — e.g. drinks to a bar printer, food to the kitchen. A printer with no categories selected prints everything else.</p>
            <div className="space-y-3">
              {printers.map((printer, i) => (
                <Card key={i} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text">Printer {i + 1}</p>
                    {printers.length > 1 && (
                      <button onClick={() => setPrinters(p => p.filter((_, j) => j !== i))}
                        className="p-1.5 rounded-lg hover:bg-red-dim text-muted hover:text-red transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 p-0.5 bg-surface2 rounded-lg w-fit">
                    {['network', 'usb'].map(t => (
                      <button key={t}
                        onClick={() => setPrinters(p => p.map((pr, j) => j === i ? { ...pr, type: t } : pr))}
                        className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize',
                          printer.type === t ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text2')}>
                        {t === 'network' ? 'WiFi / Network' : 'USB'}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Printer Name" placeholder="e.g. Kitchen, Counter"
                      value={printer.name}
                      onChange={e => setPrinters(p => p.map((pr, j) => j === i ? { ...pr, name: e.target.value } : pr))} />
                    {printer.type === 'usb' ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-text2">Windows Printer</label>
                        {systemPrinters.length > 0 ? (
                          <select
                            value={printer.usbName}
                            onChange={e => setPrinters(p => p.map((pr, j) => j === i ? { ...pr, usbName: e.target.value } : pr))}
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-green">
                            <option value="">-- Select printer --</option>
                            {systemPrinters.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                        ) : (
                          <p className="text-xs text-muted py-2">No printers detected. Make sure your printer driver is installed.</p>
                        )}
                      </div>
                    ) : (
                      <Input label="IP Address" placeholder="e.g. 192.168.1.100"
                        value={printer.ip}
                        onChange={e => setPrinters(p => p.map((pr, j) => j === i ? { ...pr, ip: e.target.value } : pr))} />
                    )}
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-border">
                    <label className="text-xs font-semibold text-text2 pt-2 block">Print which items?</label>
                    <p className="text-[11px] text-muted">Pick the menu categories this printer should handle (e.g. drinks → bar printer). Leave all unselected to print <b>everything else</b> not claimed by another printer.</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {menuCategories.length === 0 ? (
                        <span className="text-[11px] text-muted">No menu categories found.</span>
                      ) : menuCategories.map(cat => {
                        const on = (printer.categories || []).includes(cat.id)
                        return (
                          <button key={cat.id} type="button"
                            onClick={() => togglePrinterCategory(i, cat.id)}
                            className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                              on ? 'bg-green text-white border-green' : 'bg-surface text-text2 border-border hover:border-green')}>
                            {on && <Check size={11} className="inline mr-1 -mt-0.5" />}{cat.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex items-center justify-between">
              {printers.length < 3 ? (
                <Button variant="secondary" size="sm" icon={<Plus size={13} />}
                  onClick={() => setPrinters(p => [...p, { name: '', type: 'network', ip: '', usbName: '', categories: [] }])}>
                  Add KOT Printer
                </Button>
              ) : <div />}
            </div>

            <h4 className="font-display font-bold text-sm text-text pt-2">Bill Printer</h4>
            <p className="text-xs text-muted">The printer at the billing counter that prints customer receipts.</p>
            <Card className="space-y-3">
              <div className="flex gap-1 p-0.5 bg-surface2 rounded-lg w-fit">
                {['network', 'usb'].map(t => (
                  <button key={t}
                    onClick={() => setBillPrinter(p => ({ ...p, type: t }))}
                    className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize',
                      billPrinter.type === t ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text2')}>
                    {t === 'network' ? 'WiFi / Network' : 'USB'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Printer Name" placeholder="e.g. Billing Counter"
                  value={billPrinter.name}
                  onChange={e => setBillPrinter(p => ({ ...p, name: e.target.value }))} />
                {billPrinter.type === 'usb' ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-text2">Windows Printer</label>
                    {systemPrinters.length > 0 ? (
                      <select
                        value={billPrinter.usbName}
                        onChange={e => setBillPrinter(p => ({ ...p, usbName: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-green">
                        <option value="">-- Select printer --</option>
                        {systemPrinters.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    ) : (
                      <p className="text-xs text-muted py-2">No printers detected. Make sure your printer driver is installed.</p>
                    )}
                  </div>
                ) : (
                  <Input label="IP Address" placeholder="e.g. 192.168.1.102"
                    value={billPrinter.ip}
                    onChange={e => setBillPrinter(p => ({ ...p, ip: e.target.value }))} />
                )}
              </div>
            </Card>

            <div className="flex justify-end">
              <Button variant="primary" size="sm" loading={savingPrinters} onClick={savePrinters}>
                Save Printers
              </Button>
            </div>
          </>
        )}
      </div>
    ),

    team: (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-text">Team Access</h3>
            <p className="text-xs text-muted mt-0.5">Manage who can log in and what they can see</p>
          </div>
          {isOwner && (
            <Button variant="primary" size="sm" icon={<Plus size={13}/>}
              onClick={() => { setTeamForm({}); setTeamModal(true) }}>
              Add Member
            </Button>
          )}
        </div>

        {!isOwner ? (
          <Card><p className="text-sm text-muted text-center py-4">Only the owner can manage team access.</p></Card>
        ) : (
          <div className="space-y-2">
            {/* Current user */}
            <Card className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green text-white flex items-center justify-center text-xs font-bold">
                {user?.name?.slice(0,1)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">{user?.name} <span className="text-muted font-normal">(you)</span></p>
                <p className="text-xs text-muted">Full access — Owner</p>
              </div>
              <Badge color="purple">Owner</Badge>
            </Card>

            {(team || []).map(member => (
              <Card key={member.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface3 text-text flex items-center justify-center text-xs font-bold">
                  {member.name.slice(0,1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text">{member.name}</p>
                  <p className="text-xs text-muted truncate">{member.email}</p>
                  <p className="text-[10px] text-muted">{ROLE_ACCESS_LABELS[member.role]}</p>
                </div>
                <Badge color={ROLE_COLORS[member.role] || 'gray'}>{member.role}</Badge>
                {!member.is_active && <Badge color="red">Inactive</Badge>}
                <div className="flex gap-1">
                  <button onClick={() => { setEditMember(member); setTeamForm({ name: member.name, role: member.role }) }}
                    className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors">
                    <Pencil size={13}/>
                  </button>
                  <button onClick={() => { if(confirm('Remove this member?')) removeMut.mutate(member.id) }}
                    className="p-1.5 rounded-lg hover:bg-red-dim text-muted hover:text-red transition-colors">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </Card>
            ))}

            {(team || []).length === 0 && (
              <Card className="text-center py-6">
                <p className="text-sm text-muted">No team members yet. Add waiters, cashiers or kitchen staff.</p>
              </Card>
            )}
          </div>
        )}

        {/* Add member modal */}
        <Modal open={teamModal} onClose={() => setTeamModal(false)} title="➕ Add Team Member"
          footer={<>
            <Button variant="secondary" onClick={() => setTeamModal(false)}>Cancel</Button>
            <Button variant="primary" loading={addMut.isPending}
              onClick={() => {
                if (!teamForm.name || !teamForm.email || !teamForm.password) { toast.error('All fields required'); return }
                addMut.mutate({ name: teamForm.name, email: teamForm.email, password: teamForm.password, role: teamForm.role || 'waiter' })
              }}>Add</Button>
          </>}>
          <div className="space-y-3">
            <Input label="Full Name" placeholder="e.g. Ramesh Kumar" value={teamForm.name||''} onChange={e=>setTF('name',e.target.value)} />
            <Input label="Email" type="email" placeholder="ramesh@restaurant.com" value={teamForm.email||''} onChange={e=>setTF('email',e.target.value)} />
            <Input label="Password" type="password" placeholder="Set a login password" value={teamForm.password||''} onChange={e=>setTF('password',e.target.value)} />
            <Select label="Role" value={teamForm.role||'cashier'} onChange={e=>setTF('role',e.target.value)}>
              <option value="cashier">Cashier — Billing, Orders & CRM</option>
              {['pro', 'custom'].includes(profile?.plan) && <option value="waiter">Waiter — Billing & Orders only</option>}
              {['pro', 'custom'].includes(profile?.plan) && <option value="kitchen">Kitchen — Kitchen Display only</option>}
            </Select>
          </div>
        </Modal>

        {/* Edit member modal */}
        <Modal open={!!editMember} onClose={() => setEditMember(null)} title="✏️ Edit Team Member"
          footer={<>
            <Button variant="secondary" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button variant="primary" loading={updateMut.isPending}
              onClick={() => updateMut.mutate({ id: editMember.id, name: teamForm.name, role: teamForm.role, ...(teamForm.password ? { password: teamForm.password } : {}) })}>
              Save
            </Button>
          </>}>
          <div className="space-y-3">
            <Input label="Full Name" value={teamForm.name||''} onChange={e=>setTF('name',e.target.value)} />
            <Select label="Role" value={teamForm.role||'cashier'} onChange={e=>setTF('role',e.target.value)}>
              <option value="cashier">Cashier</option>
              {['pro', 'custom'].includes(profile?.plan) && <option value="waiter">Waiter</option>}
              {['pro', 'custom'].includes(profile?.plan) && <option value="kitchen">Kitchen</option>}
            </Select>
            <Input label="New Password (leave blank to keep)" type="password" placeholder="Optional"
              value={teamForm.password||''} onChange={e=>setTF('password',e.target.value)} />
          </div>
        </Modal>
      </div>
    ),

    security: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Security</h3>
        <Card className="space-y-3">
          <div className="flex items-start gap-2">
            <KeyRound size={16} className="text-green2 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-text">Change Password</p>
              <p className="text-xs text-muted">
                Enter your current password to confirm it's you, then set a new one (at least 8 characters).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Input label="Current Password" type="password" placeholder="Enter current password"
              autoComplete="current-password"
              value={pwForm.current} onChange={e => setPW('current', e.target.value)} />
            <Input label="New Password" type="password" placeholder="At least 8 characters"
              autoComplete="new-password"
              value={pwForm.next} onChange={e => setPW('next', e.target.value)} />
            <Input label="Confirm New Password" type="password" placeholder="Re-enter new password"
              autoComplete="new-password"
              value={pwForm.confirm} onChange={e => setPW('confirm', e.target.value)} />
            <Button variant="primary" size="sm" loading={pwSaving} onClick={handleChangePassword}>
              Change Password
            </Button>
          </div>
        </Card>
      </div>
    ),
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full overflow-y-auto md:overflow-hidden">
      <Card className="w-full md:w-44 flex-shrink-0 md:self-start space-y-1 p-2">
        <div className="flex flex-wrap md:flex-col gap-1">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left',
              'md:w-full',
              active === s.id ? 'bg-green-dim text-green2 font-semibold' : 'text-text2 hover:bg-surface2 hover:text-text'
            )}>
            <s.icon size={14} />{s.label}
          </button>
        ))}
        </div>
      </Card>
      <div className="flex-1 md:overflow-y-auto pb-8">{content[active]}</div>
    </div>
  )
}