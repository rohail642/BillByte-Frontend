import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '../api/auth'
import { useAuthStore } from '../store/auth'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Toggle from '../components/ui/Toggle'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Store, Receipt, Link2, Bell, FileText } from 'lucide-react'
import { clsx } from 'clsx'

const SECTIONS = [
  { id: 'restaurant',    label: 'Restaurant',    icon: Store    },
  { id: 'billing',       label: 'Billing',       icon: Receipt  },
  { id: 'integrations',  label: 'Integrations',  icon: Link2    },
  { id: 'notifications', label: 'Notifications', icon: Bell     },
  { id: 'gst',           label: 'GST / Tax',     icon: FileText },
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

  const [form, setForm] = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (profile) {
      setForm({
        name:            profile.name            || '',
        phone:           profile.phone           || '',
        restaurant_name: profile.restaurant_name || '',
        address:         profile.address         || '',
        city:            profile.city            || '',
        gstin:           profile.gstin           || '',
        fssai:           profile.fssai           || '',
        gst_rate:             profile.gst_rate             ?? 5,
        zomato_enabled:       profile.zomato_enabled       || false,
        zomato_restaurant_id: profile.zomato_restaurant_id || '',
        zomato_secret:        '',
        swiggy_enabled:       profile.swiggy_enabled       || false,
        swiggy_restaurant_id: profile.swiggy_restaurant_id || '',
        swiggy_secret:        '',
        razorpay_enabled:     profile.razorpay_enabled     || false,
        razorpay_key_id:      profile.razorpay_key_id      || '',
        razorpay_key_secret:  '',
      })
    }
  }, [profile])

  const saveMut = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      toast.success('Settings saved!')
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
    onSuccess: () => toast.success('GST settings saved!'),
    onError: (e) => toast.error(String(e)),
  })

  const content = {
    restaurant: (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-text">Restaurant Profile</h3>
        {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : (
          <Card className="space-y-3">
            <Input label="Restaurant Name" value={form.restaurant_name || ''} onChange={e => set('restaurant_name', e.target.value)} placeholder="e.g. Spice Garden" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Owner Name" value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Your name" />
              <Input label="Phone" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <Input label="Address" value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="12, MG Road, Bengaluru" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="Bengaluru" />
              <Input label="FSSAI No." value={form.fssai || ''} onChange={e => set('fssai', e.target.value)} placeholder="Enter FSSAI number" />
            </div>
            <Button variant="primary" size="sm" loading={saveMut.isPending}
              onClick={() => saveMut.mutate({ name: form.name, phone: form.phone, restaurant_name: form.restaurant_name, address: form.address, city: form.city, fssai: form.fssai })}>
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
            <Toggle checked={form.zomato_enabled || false} onChange={() => set('zomato_enabled', !form.zomato_enabled)} label="" />
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
            <Toggle checked={form.swiggy_enabled || false} onChange={() => set('swiggy_enabled', !form.swiggy_enabled)} label="" />
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
            <div className="grid grid-cols-2 gap-3">
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
  }

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      <Card className="w-44 flex-shrink-0 self-start space-y-1 p-2">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left',
              active === s.id ? 'bg-green-dim text-green2 font-semibold' : 'text-text2 hover:bg-surface2 hover:text-text'
            )}>
            <s.icon size={14} />{s.label}
          </button>
        ))}
      </Card>
      <div className="flex-1 overflow-y-auto">{content[active]}</div>
    </div>
  )
}