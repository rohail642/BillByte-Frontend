import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCustomers, createCustomer, redeemPoints, getHistory } from '../api/customers'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Plus, Phone, Gift, TrendingUp, Users, Star, ChevronRight, ArrowLeft, ShoppingBag, Award } from 'lucide-react'
import { formatINR, initials, avatarColor } from '../utils'

const SEGMENT = (visits) =>
  visits >= 10 ? { label: 'VIP', color: 'purple' } :
  visits >= 5  ? { label: 'Regular', color: 'blue' } :
  visits >= 2  ? { label: 'Returning', color: 'green' } :
                 { label: 'New', color: 'gray' }

export default function CRM() {
  const qc = useQueryClient()
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState(null) // customer object
  const [addModal,    setAddModal]    = useState(false)
  const [redeemModal, setRedeemModal] = useState(false)
  const [redeemPts,   setRedeemPts]   = useState('')
  const [form,        setForm]        = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => getCustomers(search ? { search } : {}),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['customerHistory', selected?.id],
    queryFn: () => getHistory(selected?.id),
    enabled: !!selected?.id,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const refetch = () => qc.invalidateQueries({ queryKey: ['customers'] })

  const createMut = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => { toast.success('Customer added!'); refetch(); setAddModal(false); setForm({}) },
    onError: e => toast.error(String(e)),
  })

  const redeemMut = useMutation({
    mutationFn: ({ id, pts }) => redeemPoints(id, pts),
    onSuccess: (data) => {
      toast.success(`✅ ${redeemPts} points redeemed = ₹${redeemPts} discount!`)
      refetch()
      qc.invalidateQueries({ queryKey: ['customerHistory', selected?.id] })
      setSelected(data) // update selected with new points
      setRedeemModal(false)
      setRedeemPts('')
    },
    onError: e => toast.error(String(e)),
  })

  const totalCustomers = (customers || []).length
  const totalPoints    = (customers || []).reduce((s, c) => s + c.loyalty_points, 0)
  const vipCount       = (customers || []).filter(c => c.total_visits >= 10).length

  // ── Profile view ──────────────────────────────────────────────────────────
  if (selected) {
    const seg = SEGMENT(selected.total_visits)
    const orders = history?.orders || []
    const loyalty = history?.loyalty_transactions || []

    return (
      <div className="space-y-4 animate-fadeUp">
        {/* Back */}
        <button onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm text-text3 hover:text-text transition-colors">
          <ArrowLeft size={15} /> Back to customers
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile card */}
          <Card className="lg:col-span-1">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
                style={{ background: avatarColor(selected.id) }}>
                {initials(selected.name)}
              </div>
              <h2 className="font-display font-bold text-lg text-text">{selected.name}</h2>
              <p className="text-sm text-muted flex items-center justify-center gap-1 mt-1">
                <Phone size={12} /> {selected.phone}
              </p>
              <div className="mt-2">
                <Badge color={seg.color}>{seg.label} Customer</Badge>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { label: 'Total Visits',  val: selected.total_visits,               color: 'text-blue'   },
                { label: 'Total Spent',   val: formatINR(selected.total_spent),      color: 'text-green2' },
                { label: 'Avg Bill',      val: formatINR(selected.total_visits ? selected.total_spent / selected.total_visits : 0), color: 'text-orange' },
                { label: 'Last Visit',    val: selected.last_visit_at ? new Date(selected.last_visit_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short'}) : '—', color: 'text-muted' },
              ].map(s => (
                <div key={s.label} className="bg-surface2 rounded-lg p-3 text-center">
                  <p className={`font-display font-black text-base ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-muted mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Loyalty points */}
            <div className="mt-4 bg-green-dim border border-green/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-green2 flex items-center gap-1"><Award size={13}/> Loyalty Points</p>
                <p className="font-display font-black text-2xl text-green2">{selected.loyalty_points}</p>
              </div>
              <p className="text-[10px] text-green2 mb-3">= ₹{selected.loyalty_points} discount value · Min 100 pts to redeem</p>
              <Button variant="primary" size="sm" className="w-full justify-center"
                disabled={selected.loyalty_points < 100}
                icon={<Gift size={13}/>}
                onClick={() => { setRedeemPts(''); setRedeemModal(true) }}>
                Redeem Points
              </Button>
            </div>
          </Card>

          {/* History */}
          <div className="lg:col-span-2 space-y-4">
            {/* Visit history */}
            <Card>
              <h3 className="font-display font-bold text-sm text-text mb-3 flex items-center gap-2">
                <ShoppingBag size={14} /> Order History
              </h3>
              {loadingHistory ? <div className="flex justify-center py-6"><Spinner /></div>
                : orders.length === 0
                  ? <EmptyState icon="🧾" title="No orders yet" description="Orders will appear here once the customer places an order" />
                  : (
                    <div className="space-y-2">
                      {orders.map(o => (
                        <div key={o.id} className="border border-border rounded-lg overflow-hidden">
                          <div className="flex items-center gap-3 p-3 bg-surface2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-text">{o.order_number}</p>
                              <p className="text-[10px] text-muted">
                                {new Date(o.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}
                                {' · '}{new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                                {o.table_number ? ` · Table ${o.table_number}` : ''}
                              </p>
                            </div>
                            <p className="font-display font-black text-sm text-green2">{formatINR(o.total_amount)}</p>
                            {o.payment_method && (
                              <Badge color="blue">{o.payment_method.toUpperCase()}</Badge>
                            )}
                            <Badge color={o.payment_status === 'paid' ? 'green' : 'orange'}>
                              {o.payment_status}
                            </Badge>
                          </div>
                          <div className="px-3 py-2 space-y-0.5">
                            {o.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs text-text3">
                                <span>{item.name} × {item.quantity}</span>
                                <span className="font-medium">{formatINR(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
            </Card>

            {/* Loyalty history */}
            <Card>
              <h3 className="font-display font-bold text-sm text-text mb-3 flex items-center gap-2">
                <Star size={14} /> Points History
              </h3>
              {loadingHistory ? <div className="flex justify-center py-4"><Spinner /></div>
                : loyalty.length === 0
                  ? <EmptyState icon="⭐" title="No points yet" description="Points are earned automatically on every paid order" />
                  : (
                    <div className="space-y-1.5">
                      {loyalty.map(t => (
                        <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="text-xs font-medium text-text">{t.description}</p>
                            <p className="text-[10px] text-muted">
                              {new Date(t.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                            </p>
                          </div>
                          <span className={`font-display font-black text-sm ${t.points > 0 ? 'text-green2' : 'text-orange'}`}>
                            {t.points > 0 ? '+' : ''}{t.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
            </Card>
          </div>
        </div>

        {/* Redeem modal */}
        <Modal open={redeemModal} onClose={() => setRedeemModal(false)} title="🎁 Redeem Loyalty Points">
          <div className="space-y-4">
            <div className="bg-green-dim border border-green/20 rounded-xl p-4 text-center">
              <p className="text-xs text-green2 mb-1">Available Points</p>
              <p className="font-display font-black text-3xl text-green2">{selected.loyalty_points}</p>
              <p className="text-xs text-green2 mt-1">= ₹{selected.loyalty_points} discount value</p>
            </div>
            <Input
              label="Points to redeem (min 100, max available)"
              type="number" min="100" max={selected.loyalty_points}
              placeholder="e.g. 200"
              value={redeemPts}
              onChange={e => setRedeemPts(e.target.value)}
            />
            {redeemPts >= 100 && (
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <p className="text-xs text-muted">Customer gets</p>
                <p className="font-display font-black text-2xl text-green2">₹{redeemPts} off</p>
                <p className="text-xs text-muted">on their next bill</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setRedeemModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1 justify-center" icon={<Gift size={13}/>}
                loading={redeemMut.isPending}
                disabled={!redeemPts || Number(redeemPts) < 100 || Number(redeemPts) > selected.loyalty_points}
                onClick={() => redeemMut.mutate({ id: selected.id, pts: Number(redeemPts) })}>
                Redeem ₹{redeemPts || 0} Off
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // ── Customer list view ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1 flex items-center gap-1"><Users size={11}/>Total Customers</p>
          <p className="font-display font-black text-2xl text-green2">{totalCustomers}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1 flex items-center gap-1"><Award size={11}/>Points Issued</p>
          <p className="font-display font-black text-2xl text-blue">{totalPoints.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1 flex items-center gap-1"><Star size={11}/>VIP Customers</p>
          <p className="font-display font-black text-2xl text-purple">{vipCount}</p>
        </Card>
      </div>

      {/* Search + Add */}
      <div className="flex gap-3">
        <input className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-green transition-all"
          placeholder="🔍 Search by name or phone..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={() => { setForm({}); setAddModal(true) }}>
          Add Customer
        </Button>
      </div>

      {/* Customer list */}
      {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        : (customers || []).length === 0
          ? <EmptyState icon="👥" title="No customers yet" description="Add customers to track their visits and reward loyalty" />
          : (
            <div className="space-y-2">
              {(customers || []).map((c, i) => {
                const seg = SEGMENT(c.total_visits)
                return (
                  <Card key={c.id} hover
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setSelected(c)}>
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: avatarColor(i) }}>
                      {initials(c.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-text">{c.name}</p>
                        <Badge color={seg.color}>{seg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Phone size={10}/> {c.phone}
                        <span className="mx-1">·</span>
                        {c.total_visits} visit{c.total_visits !== 1 ? 's' : ''}
                        <span className="mx-1">·</span>
                        {formatINR(c.total_spent)} spent
                      </p>
                    </div>

                    {/* Points */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-display font-black text-base text-green2">{c.loyalty_points}</p>
                      <p className="text-[10px] text-muted">points</p>
                    </div>

                    {/* Last visit */}
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <p className="text-xs text-text2">{c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—'}</p>
                      <p className="text-[10px] text-muted">last visit</p>
                    </div>

                    <ChevronRight size={15} className="text-muted flex-shrink-0" />
                  </Card>
                )
              })}
            </div>
          )}

      {/* Add customer modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="➕ Add Customer"
        footer={<>
          <Button variant="secondary" onClick={() => setAddModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending}
            onClick={() => {
              if (!form.name || !form.phone) { toast.error('Name and phone required'); return }
              createMut.mutate({ name: form.name, phone: form.phone })
            }}>
            Add Customer
          </Button>
        </>}>
        <div className="space-y-3">
          <Input label="Full Name" placeholder="e.g. Priya Sharma"
            value={form.name || ''} onChange={e => set('name', e.target.value)} />
          <Input label="Phone Number" placeholder="+91 98765 43210"
            value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}