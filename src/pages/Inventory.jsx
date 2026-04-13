import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInventory, createItem, updateItem, restockItem, manualDeduct, deleteItem,
  getUsageHistory, getUsageSummary, getAlerts,
  getPOs, createPO, updatePO,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from '../api/inventory'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { formatINR } from '../utils'
import { Plus, RefreshCw, AlertTriangle, Clock, Trash2, Pencil, History, Minus, Users } from 'lucide-react'
import { clsx } from 'clsx'

const TABS = ['Stock', 'Alerts', 'Usage History', 'Purchase Orders', 'Suppliers']

export default function Inventory() {
  const qc = useQueryClient()
  const [tab, setTab]                   = useState('Stock')
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [form, setForm]                 = useState({})
  const [selectedItem, setSelectedItem] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: items,     isLoading }  = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({}) })
  const { data: alerts }               = useQuery({ queryKey: ['invAlerts'], queryFn: getAlerts, refetchInterval: 60000 })
  const { data: pos }                  = useQuery({ queryKey: ['pos'], queryFn: getPOs })
  const { data: suppliers }            = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers })
  const { data: usageSummary }         = useQuery({ queryKey: ['usageSummary'], queryFn: () => getUsageSummary(7) })
  const { data: itemUsage }            = useQuery({
    queryKey: ['itemUsage', selectedItem?.id],
    queryFn: () => getUsageHistory(selectedItem.id),
    enabled: !!selectedItem,
  })

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['invAlerts'] })
    qc.invalidateQueries({ queryKey: ['usageSummary'] })
  }

  const createMut   = useMutation({ mutationFn: createItem,   onSuccess: () => { toast.success('Item added!');      refetchAll(); setModal(null) }, onError: e => toast.error(String(e)) })
  const updateMut   = useMutation({ mutationFn: ({id,...b}) => updateItem(id, b), onSuccess: () => { toast.success('Item updated!'); refetchAll(); setModal(null) }, onError: e => toast.error(String(e)) })
  const deleteMut   = useMutation({ mutationFn: deleteItem,   onSuccess: () => { toast.success('Item removed!');    refetchAll() }, onError: e => toast.error(String(e)) })
  const restockMut  = useMutation({ mutationFn: ({id,qty,notes}) => restockItem(id, qty, notes), onSuccess: () => { toast.success('Restocked!'); refetchAll(); setModal(null) }, onError: e => toast.error(String(e)) })
  const deductMut   = useMutation({ mutationFn: ({id,...b}) => manualDeduct(id, b), onSuccess: () => { toast.success('Stock deducted!'); refetchAll(); setModal(null) }, onError: e => toast.error(String(e)) })
  const createPoMut = useMutation({ mutationFn: createPO,     onSuccess: () => { toast.success('PO created!');      qc.invalidateQueries({queryKey:['pos']}); setModal(null) }, onError: e => toast.error(String(e)) })
  const updatePoMut = useMutation({ mutationFn: ({id,...b}) => updatePO(id, b), onSuccess: () => { toast.success('PO updated!'); qc.invalidateQueries({queryKey:['pos']}) }, onError: e => toast.error(String(e)) })
  const createSupMut= useMutation({ mutationFn: createSupplier, onSuccess: () => { toast.success('Supplier added!'); qc.invalidateQueries({queryKey:['suppliers']}); setModal(null) }, onError: e => toast.error(String(e)) })
  const updateSupMut= useMutation({ mutationFn: ({id,...b}) => updateSupplier(id, b), onSuccess: () => { toast.success('Supplier updated!'); qc.invalidateQueries({queryKey:['suppliers']}); setModal(null) }, onError: e => toast.error(String(e)) })
  const deleteSupMut= useMutation({ mutationFn: deleteSupplier, onSuccess: () => { toast.success('Supplier removed!'); qc.invalidateQueries({queryKey:['suppliers']}) }, onError: e => toast.error(String(e)) })

  const filtered = (items || []).filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
  const lowCount  = alerts?.low_stock_count  || 0
  const expCount  = alerts?.expiring_soon_count || 0
  const expdCount = alerts?.expired_count || 0
  const totalAlerts = lowCount + expCount + expdCount

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalVal  = (items || []).reduce((s, i) => s + i.stock_value, 0)

  const openAdd  = () => { setForm({ unit: 'kg' }); setModal('add') }
  const openEdit = (item) => { setForm({ ...item, expiry_date: item.expiry_date || '' }); setModal('edit') }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Items',     val: (items||[]).length,       color: 'green'  },
          { label: 'Low Stock',       val: lowCount,                  color: 'orange', alert: lowCount > 0  },
          { label: 'Expiring Soon',   val: expCount + expdCount,      color: 'red',    alert: expCount > 0  },
          { label: 'Stock Value',     val: formatINR(totalVal),       color: 'blue'   },
        ].map(k => (
          <Card key={k.label} className={k.alert ? 'border-orange/40' : ''}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">{k.label}</p>
            <p className={`font-display font-black text-2xl`} style={{ color: `var(--${k.color})` }}>{k.val}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative',
              tab === t ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}>
            {t}
            {t === 'Alerts' && totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {totalAlerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── STOCK TAB ── */}
      {tab === 'Stock' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input className="flex-1 min-w-48 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-green transition-all"
              placeholder="🔍 Search stock..." value={search} onChange={e => setSearch(e.target.value)} />
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>} onClick={refetchAll}>Refresh</Button>
            <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={openAdd}>Add Item</Button>
          </div>

          {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg"/></div> : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    {['Item','Category','Qty','Min','Value','Expiry','Supplier','Status',''].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-muted pb-2 px-2 first:pl-0">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map(item => {
                      const sup = (suppliers||[]).find(s => s.id === item.supplier_id)
                      const expiryDays = item.expiry_date ? Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000) : null
                      return (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors group">
                          <td className="py-2.5 px-2 pl-0 font-semibold text-text">{item.name}</td>
                          <td className="py-2.5 px-2 text-text3 text-xs">{item.category || '—'}</td>
                          <td className={`py-2.5 px-2 font-bold ${item.is_low_stock ? 'text-orange' : 'text-green2'}`}>
                            {item.quantity} <span className="text-muted font-normal">{item.unit}</span>
                          </td>
                          <td className="py-2.5 px-2 text-text3">{item.min_quantity} {item.unit}</td>
                          <td className="py-2.5 px-2 text-text3">{formatINR(item.stock_value)}</td>
                          <td className="py-2.5 px-2">
                            {item.expiry_date ? (
                              <span className={clsx('text-xs font-semibold', item.is_expired ? 'text-red' : item.is_expiring_soon ? 'text-orange' : 'text-text3')}>
                                {item.is_expired ? '❌ Expired' : item.is_expiring_soon ? `⚠ ${expiryDays}d` : new Date(item.expiry_date).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}
                              </span>
                            ) : <span className="text-muted text-xs">—</span>}
                          </td>
                          <td className="py-2.5 px-2 text-xs text-text3">{sup?.name || '—'}</td>
                          <td className="py-2.5 px-2">
                            {item.is_expired     ? <Badge color="red">Expired</Badge>
                            : item.is_expiring_soon ? <Badge color="orange">Expiring</Badge>
                            : item.is_low_stock  ? <Badge color="orange">Low</Badge>
                            : <Badge color="green">OK</Badge>}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setSelectedItem(item); setModal('usage') }}
                                className="p-1.5 rounded-lg hover:bg-surface3 text-muted hover:text-blue transition-colors" title="Usage history">
                                <History size={13}/>
                              </button>
                              <button onClick={() => { setForm({ id: item.id, name: item.name, unit: item.unit, qty: '', notes: '' }); setModal('restock') }}
                                className="p-1.5 rounded-lg hover:bg-surface3 text-muted hover:text-green2 transition-colors" title="Restock">
                                <Plus size={13}/>
                              </button>
                              <button onClick={() => { setForm({ id: item.id, name: item.name, unit: item.unit, qty: '', reason: 'manual' }); setModal('deduct') }}
                                className="p-1.5 rounded-lg hover:bg-surface3 text-muted hover:text-orange transition-colors" title="Deduct stock">
                                <Minus size={13}/>
                              </button>
                              <button onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg hover:bg-surface3 text-muted hover:text-text transition-colors" title="Edit">
                                <Pencil size={13}/>
                              </button>
                              <button onClick={() => { if(confirm('Remove this item?')) deleteMut.mutate(item.id) }}
                                className="p-1.5 rounded-lg hover:bg-red-dim text-muted hover:text-red transition-colors" title="Delete">
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <EmptyState icon="📦" title="No stock items" description="Add your first item to get started" />}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── ALERTS TAB ── */}
      {tab === 'Alerts' && (
        <div className="space-y-4">
          {/* Low stock */}
          <Card>
            <h3 className="font-display font-bold text-sm text-orange mb-3 flex items-center gap-2">
              <AlertTriangle size={15}/> Low Stock ({alerts?.low_stock_count || 0})
            </h3>
            {(alerts?.low_stock_items || []).length === 0
              ? <p className="text-sm text-muted">All stock levels are healthy ✅</p>
              : (alerts.low_stock_items).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text">{item.name}</p>
                    <p className="text-xs text-muted">Has {item.quantity} {item.unit} · Min required: {item.min_quantity} {item.unit}</p>
                  </div>
                  <Badge color="orange">⚠ Low</Badge>
                  <Button variant="primary" size="xs" icon={<Plus size={11}/>}
                    onClick={() => { setForm({ id: item.id, name: item.name, unit: item.unit, qty: '' }); setModal('restock') }}>
                    Restock
                  </Button>
                </div>
              ))}
          </Card>

          {/* Expiring */}
          <Card>
            <h3 className="font-display font-bold text-sm text-red mb-3 flex items-center gap-2">
              <Clock size={15}/> Expiring Soon / Expired ({(alerts?.expiring_soon_count || 0) + (alerts?.expired_count || 0)})
            </h3>
            {[...(alerts?.expired_items||[]), ...(alerts?.expiring_items||[])].length === 0
              ? <p className="text-sm text-muted">No expiry alerts ✅</p>
              : [...(alerts?.expired_items||[]), ...(alerts?.expiring_items||[])].map(item => {
                const expiryDays = item.expiry_date ? Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000) : null
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text">{item.name}</p>
                      <p className="text-xs text-muted">
                        Expires: {new Date(item.expiry_date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}
                        {expiryDays !== null && ` · ${item.is_expired ? 'Expired' : `${expiryDays} days left`}`}
                      </p>
                    </div>
                    <Badge color={item.is_expired ? 'red' : 'orange'}>
                      {item.is_expired ? 'Expired' : `${expiryDays}d left`}
                    </Badge>
                  </div>
                )
              })}
          </Card>
        </div>
      )}

      {/* ── USAGE HISTORY TAB ── */}
      {tab === 'Usage History' && (
        <Card>
          <h3 className="font-display font-bold text-sm text-text mb-4">Daily Usage — Last 7 Days</h3>
          {(usageSummary || []).length === 0
            ? <EmptyState icon="📊" title="No usage data yet" description="Usage is tracked automatically when stock is deducted" />
            : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  {['Date','Item','Quantity Used'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-muted pb-2 px-2 first:pl-0">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {usageSummary.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-surface2">
                      <td className="py-2 px-2 pl-0 text-text3 text-xs">{new Date(row.date).toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'})}</td>
                      <td className="py-2 px-2 font-medium text-text">{row.item}</td>
                      <td className="py-2 px-2 font-bold text-orange">{row.used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      )}

      {/* ── PURCHASE ORDERS TAB ── */}
      {tab === 'Purchase Orders' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={<Plus size={13}/>}
              onClick={() => { setForm({}); setModal('po') }}>
              New Purchase Order
            </Button>
          </div>
          <div className="space-y-2">
            {(pos||[]).map(po => (
              <Card key={po.id}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-text">{po.po_number} · {po.supplier_name}</p>
                    <p className="text-xs text-muted mt-0.5">{po.items_description}</p>
                    {po.expected_delivery && (
                      <p className="text-xs text-muted">Expected: {new Date(po.expected_delivery).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
                    )}
                    {po.notes && <p className="text-xs text-muted italic mt-0.5">{po.notes}</p>}
                  </div>
                  <p className="font-display font-black text-sm text-text">{formatINR(po.total_amount)}</p>
                  <select
                    className="bg-surface2 border border-border2 rounded-lg px-2 py-1 text-xs outline-none focus:border-green cursor-pointer"
                    value={po.status}
                    onChange={e => updatePoMut.mutate({ id: po.id, status: e.target.value })}>
                    <option value="ordered">Ordered</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <Badge color={po.status==='delivered'?'green':po.status==='ordered'?'blue':'red'}>{po.status}</Badge>
                </div>
              </Card>
            ))}
            {(pos||[]).length === 0 && <EmptyState icon="📋" title="No purchase orders" description="Create your first PO to track supplier orders" />}
          </div>
        </div>
      )}

      {/* ── SUPPLIERS TAB ── */}
      {tab === 'Suppliers' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={<Plus size={13}/>}
              onClick={() => { setForm({}); setModal('supplier') }}>
              Add Supplier
            </Button>
          </div>
          {(suppliers||[]).length === 0
            ? <EmptyState icon="🏪" title="No suppliers yet" description="Add suppliers to track where you order from" />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(suppliers||[]).map(s => (
                  <Card key={s.id} className="group">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-dim text-blue flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {s.name.slice(0,1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-text">{s.name}</p>
                        {s.phone && <p className="text-xs text-muted">📞 {s.phone}</p>}
                        {s.email && <p className="text-xs text-muted">✉️ {s.email}</p>}
                        {s.address && <p className="text-xs text-muted">📍 {s.address}</p>}
                        {s.notes && <p className="text-xs text-muted italic mt-1">{s.notes}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setForm({...s}); setModal('editSupplier') }}
                          className="p-1 rounded hover:bg-surface2 text-muted hover:text-text transition-colors">
                          <Pencil size={13}/>
                        </button>
                        <button onClick={() => { if(confirm('Remove supplier?')) deleteSupMut.mutate(s.id) }}
                          className="p-1 rounded hover:bg-red-dim text-muted hover:text-red transition-colors">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* Add/Edit item */}
      <Modal open={modal==='add'||modal==='edit'} onClose={()=>setModal(null)}
        title={modal==='add' ? '✚ Add Stock Item' : '✏️ Edit Item'}
        footer={<>
          <Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button>
          <Button variant="primary"
            loading={createMut.isPending||updateMut.isPending}
            onClick={() => {
              const payload = { name:form.name, quantity:Number(form.quantity)||0, unit:form.unit||'kg', min_quantity:Number(form.min_quantity)||0, cost_per_unit:Number(form.cost_per_unit)||0, category:form.category||null, supplier_id:form.supplier_id?Number(form.supplier_id):null, expiry_date:form.expiry_date||null }
              modal==='add' ? createMut.mutate(payload) : updateMut.mutate({id:form.id,...payload})
            }}>
            {modal==='add' ? 'Add Item' : 'Save'}
          </Button>
        </>}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Input label="Item Name" placeholder="e.g. Basmati Rice" value={form.name||''} onChange={e=>set('name',e.target.value)}/></div>
            <Select label="Unit" value={form.unit||'kg'} onChange={e=>set('unit',e.target.value)}>
              {['kg','L','pcs','g','ml','dozen','liter'].map(u=><option key={u}>{u}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input label="Quantity" type="number" placeholder="0" value={form.quantity||''} onChange={e=>set('quantity',e.target.value)}/>
            <Input label="Min Qty" type="number" placeholder="0" value={form.min_quantity||''} onChange={e=>set('min_quantity',e.target.value)}/>
            <Input label="Cost/unit ₹" type="number" placeholder="0" value={form.cost_per_unit||''} onChange={e=>set('cost_per_unit',e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Category" placeholder="e.g. Dairy" value={form.category||''} onChange={e=>set('category',e.target.value)}/>
            <Input label="Expiry Date" type="date" value={form.expiry_date||''} onChange={e=>set('expiry_date',e.target.value)}/>
          </div>
          <Select label="Supplier (optional)" value={form.supplier_id||''} onChange={e=>set('supplier_id',e.target.value)}>
            <option value="">No supplier</option>
            {(suppliers||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </Modal>

      {/* Restock */}
      <Modal open={modal==='restock'} onClose={()=>setModal(null)} title={`Restock: ${form.name}`}
        footer={<>
          <Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button>
          <Button variant="primary" loading={restockMut.isPending}
            onClick={()=>restockMut.mutate({id:form.id,qty:Number(form.qty)||0,notes:form.notes||null})}>
            Restock
          </Button>
        </>}>
        <div className="space-y-3">
          <Input label={`Quantity to add (${form.unit})`} type="number" placeholder="e.g. 10" value={form.qty||''} onChange={e=>set('qty',e.target.value)}/>
          <Input label="Notes (optional)" placeholder="e.g. Received from FreshMart" value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
        </div>
      </Modal>

      {/* Deduct */}
      <Modal open={modal==='deduct'} onClose={()=>setModal(null)} title={`Deduct Stock: ${form.name}`}
        footer={<>
          <Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={deductMut.isPending}
            onClick={()=>deductMut.mutate({id:form.id,quantity_used:Number(form.qty)||0,reason:form.reason||'manual',notes:form.notes||null})}>
            Deduct
          </Button>
        </>}>
        <div className="space-y-3">
          <Input label={`Quantity to deduct (${form.unit})`} type="number" placeholder="e.g. 2" value={form.qty||''} onChange={e=>set('qty',e.target.value)}/>
          <Select label="Reason" value={form.reason||'manual'} onChange={e=>set('reason',e.target.value)}>
            <option value="manual">Manual adjustment</option>
            <option value="waste">Waste / Spoilage</option>
            <option value="expired">Expired</option>
            <option value="damaged">Damaged</option>
          </Select>
          <Input label="Notes (optional)" placeholder="Additional details..." value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
        </div>
      </Modal>

      {/* Usage history for specific item */}
      <Modal open={modal==='usage'} onClose={()=>{setModal(null);setSelectedItem(null)}} title={`Usage History: ${selectedItem?.name}`} size="lg">
        {!itemUsage ? <div className="flex justify-center py-8"><Spinner/></div> : itemUsage.length === 0
          ? <EmptyState icon="📊" title="No usage history" description="Usage will appear here once stock is deducted"/>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {['Date','Qty Changed','Reason','Notes'].map(h=>(
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-muted pb-2 px-2 first:pl-0">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {itemUsage.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface2">
                    <td className="py-2 px-2 pl-0 text-xs text-text3">{new Date(log.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                    <td className={`py-2 px-2 font-bold ${log.quantity_used < 0 ? 'text-green2' : 'text-orange'}`}>
                      {log.quantity_used < 0 ? `+${Math.abs(log.quantity_used)}` : `-${log.quantity_used}`}
                    </td>
                    <td className="py-2 px-2"><Badge color={log.reason==='restock'?'green':log.reason==='waste'?'red':'gray'}>{log.reason}</Badge></td>
                    <td className="py-2 px-2 text-xs text-text3">{log.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Modal>

      {/* Purchase Order */}
      <Modal open={modal==='po'} onClose={()=>setModal(null)} title="Create Purchase Order"
        footer={<>
          <Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button>
          <Button variant="primary" loading={createPoMut.isPending}
            onClick={()=>createPoMut.mutate({supplier_name:form.supplier_name||'',supplier_id:form.supplier_id?Number(form.supplier_id):null,items_description:form.items_description||'',total_amount:Number(form.total_amount)||0,notes:form.notes||null,expected_delivery:form.expected_delivery||null})}>
            Create PO
          </Button>
        </>}>
        <div className="space-y-3">
          <Select label="Supplier" value={form.supplier_id||''} onChange={e=>{
            const s=(suppliers||[]).find(x=>x.id===Number(e.target.value))
            set('supplier_id',e.target.value); if(s) set('supplier_name',s.name)
          }}>
            <option value="">Select supplier or type below</option>
            {(suppliers||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Supplier Name" placeholder="FreshMart Supplies" value={form.supplier_name||''} onChange={e=>set('supplier_name',e.target.value)}/>
          <Input label="Items Ordered" placeholder="Chicken 10kg, Paneer 5kg" value={form.items_description||''} onChange={e=>set('items_description',e.target.value)}/>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Total Amount (₹)" type="number" placeholder="0" value={form.total_amount||''} onChange={e=>set('total_amount',e.target.value)}/>
            <Input label="Expected Delivery" type="date" value={form.expected_delivery||''} onChange={e=>set('expected_delivery',e.target.value)}/>
          </div>
          <Input label="Notes (optional)" placeholder="Any special instructions..." value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
        </div>
      </Modal>

      {/* Add/Edit Supplier */}
      <Modal open={modal==='supplier'||modal==='editSupplier'} onClose={()=>setModal(null)}
        title={modal==='supplier' ? '🏪 Add Supplier' : '✏️ Edit Supplier'}
        footer={<>
          <Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button>
          <Button variant="primary" loading={createSupMut.isPending||updateSupMut.isPending}
            onClick={()=>{
              const payload={name:form.name,phone:form.phone||null,email:form.email||null,address:form.address||null,notes:form.notes||null}
              modal==='supplier' ? createSupMut.mutate(payload) : updateSupMut.mutate({id:form.id,...payload})
            }}>
            {modal==='supplier' ? 'Add Supplier' : 'Save'}
          </Button>
        </>}>
        <div className="space-y-3">
          <Input label="Supplier Name*" placeholder="FreshMart Supplies" value={form.name||''} onChange={e=>set('name',e.target.value)}/>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Phone" placeholder="+91 98765 43210" value={form.phone||''} onChange={e=>set('phone',e.target.value)}/>
            <Input label="Email" placeholder="supplier@email.com" value={form.email||''} onChange={e=>set('email',e.target.value)}/>
          </div>
          <Input label="Address" placeholder="123, Market Road, Bengaluru" value={form.address||''} onChange={e=>set('address',e.target.value)}/>
          <Input label="Notes" placeholder="Delivers Mon-Fri, min order ₹2000..." value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
        </div>
      </Modal>
    </div>
  )
}