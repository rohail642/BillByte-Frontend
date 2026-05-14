import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '../api/auth'
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
import { Store, Receipt, Link2, Bell, FileText, Users, Plus, Trash2, Pencil, UtensilsCrossed } from 'lucide-react'
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
  { id: 'team',          label: 'Team Access',   icon: Users           },
]

export default function Settings() {
  const [active, setActive] = useState('restaurant')
  const qc = useQueryClient()

  const [toggles, setToggles] = useState({
    autoPrint: true, whatsapp: true, roundOff: false, loyalty: true,
    zomato: true, swiggy: true, razorpay: true, tally: false,
    orderAlert: true, lowStock: true, dailySummary: true, showGst: true,
  })
  const toggle = k => setToggles(t => ({ ...t, [k]: !t[k] }))

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  })

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
  function toggleTableInSection(sectionId, tableNum) {
    setOverrides(o => ({
      ...o,
      table_sections: (o.table_sections ?? baseForm.table_sections ?? []).map(s => {
        if (s.id !== sectionId) return s
        const has = s.tables.includes(tableNum)
        return { ...s, tables: has ? s.tables.filter(t => t !== tableNum) : [...s.tables, tableNum].sort((a,b)=>a-b) }
      }),
    }))
  }

  const saveTablesMut = useMutation({
    mutationFn: () => updateProfile({ table_count: form.table_count, table_sections: form.table_sections }),
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
    onSuccess: () => { toast.success('GST settings saved!'); setOverrides({}) },
    onError: (e) => toast.error(String(e)),
  })

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
          <Toggle checked={toggles.autoPrint} onChange={() => toggle('autoPrint')} label="Auto-print bill after payment"  description="Printer fires automatically on payment" />
          <Toggle checked={toggles.whatsapp}  onChange={() => toggle('whatsapp')}  label="WhatsApp bill sharing"          description="Send bill to customer via WhatsApp" />
          <Toggle checked={toggles.roundOff}  onChange={() => toggle('roundOff')}  label="Round-off bill amount"          description="Round to nearest ₹10" />
          <Toggle checked={toggles.loyalty}   onChange={() => toggle('loyalty')}   label="Loyalty points on dine-in"      description="1 point per ₹10 spent" />
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
                  <code className="text-xs text-green2 break-all">https://yourdomain.com/api/webhooks/zomato/{profile.restaurant_id}</code>
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
                  <code className="text-xs text-green2 break-all">https://yourdomain.com/api/webhooks/swiggy/{profile.restaurant_id}</code>
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

        {/* WhatsApp note */}
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <div>
              <p className="text-sm font-bold text-text">WhatsApp Orders</p>
              <p className="text-xs text-muted">No setup needed — staff manually enters WhatsApp orders using the New Order button on the Online Orders page.</p>
            </div>
          </div>
        </Card>

        <Button variant="primary" size="sm" loading={saveMut.isPending}
          onClick={() => saveMut.mutate({
            zomato_enabled: form.zomato_enabled,
            zomato_secret: form.zomato_secret,
            zomato_restaurant_id: form.zomato_restaurant_id,
            swiggy_enabled: form.swiggy_enabled,
            swiggy_secret: form.swiggy_secret,
            swiggy_restaurant_id: form.swiggy_restaurant_id,
            razorpay_enabled: form.razorpay_enabled,
            razorpay_key_id: form.razorpay_key_id,
            ...(form.razorpay_key_secret ? { razorpay_key_secret: form.razorpay_key_secret } : {}),
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="GST Rate %" type="number" value={form.gst_rate ?? 5} onChange={e => set('gst_rate', Number(e.target.value))} />
              <Input label="Takeaway GST %" type="number" defaultValue="5" />
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

        {/* Total count */}
        <Card className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-text mb-0.5">Total Tables</p>
            <p className="text-[10px] text-muted mb-2">How many physical tables does your restaurant have?</p>
            <div className="flex items-center gap-3">
              <input
                type="number" min="1" max="100"
                value={form.table_count ?? 10}
                onChange={e => set('table_count', Number(e.target.value))}
                className="w-24 bg-bg border border-border2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green transition-colors"
              />
              <span className="text-xs text-muted">tables</span>
            </div>
          </div>
        </Card>

        {/* Sections */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-text">Table Sections</p>
            <p className="text-[10px] text-muted mt-0.5">Group tables by zone — AC, Non-AC, Outdoor, Rooftop, etc.</p>
          </div>
          <Button variant="secondary" size="sm" icon={<Plus size={13}/>} onClick={addSection}>
            Add Section
          </Button>
        </div>

        {(form.table_sections || []).length === 0 && (
          <Card className="text-center py-6">
            <UtensilsCrossed size={24} className="text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">No sections yet.</p>
            <p className="text-xs text-muted mt-0.5">Add sections to organize tables by zone (AC, Non-AC, etc.)</p>
          </Card>
        )}

        {(form.table_sections || []).map((section) => {
          const colorHex = SECTION_COLORS.find(c => c.id === section.color)?.hex || '#78716c'
          const assignedInOthers = new Set(
            (form.table_sections || []).filter(s => s.id !== section.id).flatMap(s => s.tables)
          )
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
                  placeholder="Section name (e.g. AC, Non-AC, Outdoor…)"
                  value={section.name}
                  onChange={e => updateSection(section.id, 'name', e.target.value)}
                />
                <span className="text-[10px] text-muted flex-shrink-0">{section.tables.length} tables</span>
                <button onClick={() => removeSection(section.id)}
                  className="text-muted hover:text-red transition-colors p-1 rounded flex-shrink-0">
                  <Trash2 size={14}/>
                </button>
              </div>

              {/* Table number picker */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
                  Select tables for this section
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: form.table_count ?? 10 }, (_, i) => i + 1).map(n => {
                    const selected = section.tables.includes(n)
                    const locked   = !selected && assignedInOthers.has(n)
                    return (
                      <button
                        key={n}
                        disabled={locked}
                        onClick={() => toggleTableInSection(section.id, n)}
                        title={locked ? 'Already in another section' : `Table ${n}`}
                        className={clsx(
                          'w-9 h-9 rounded-lg text-xs font-bold border transition-all',
                          selected
                            ? 'text-white border-transparent'
                            : locked
                              ? 'bg-surface2 border-border text-muted opacity-40 cursor-not-allowed'
                              : 'bg-surface2 border-border text-text2 hover:border-green/50 hover:text-green'
                        )}
                        style={selected ? { background: colorHex, borderColor: colorHex } : {}}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
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
            <Select label="Role" value={teamForm.role||'waiter'} onChange={e=>setTF('role',e.target.value)}>
              <option value="waiter">Waiter — Billing & Orders only</option>
              <option value="cashier">Cashier — Billing, Orders & CRM</option>
              <option value="kitchen">Kitchen — Kitchen Display only</option>
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
            <Select label="Role" value={teamForm.role||'waiter'} onChange={e=>setTF('role',e.target.value)}>
              <option value="waiter">Waiter</option>
              <option value="cashier">Cashier</option>
              <option value="kitchen">Kitchen</option>
            </Select>
            <Input label="New Password (leave blank to keep)" type="password" placeholder="Optional"
              value={teamForm.password||''} onChange={e=>setTF('password',e.target.value)} />
          </div>
        </Modal>
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