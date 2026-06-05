import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSalesReport, getTopDishes, getRevenueTrend } from '../api/reports'
import { getOrders } from '../api/orders'
import client from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { formatINR } from '../utils'

import toast from 'react-hot-toast'

function download(content, filename, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function toCSV(rows) {
  return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

function fmtDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function csvHeader(title, from, to) {
  const period = !from ? 'All Orders' : from === to ? fmtDate(from) : `${fmtDate(from)}  to  ${fmtDate(to)}`
  const exported = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return [
    [title, '', '', '', '', '', '', '', '', '', '', '', ''],
    [`Period: ${period}`],
    [`Exported on: ${exported}`],
    [],
  ]
}

function inr(v) { return Number(v || 0).toFixed(2) }

const PERIODS = ['today', 'week', 'month']
const COLORS  = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#d97706']
const PAYMENT_COLORS = { cash: '#16a34a', upi: '#2563eb', card: '#7c3aed' }
const PAYMENT_EMOJI  = { cash: '💵', upi: '📱', card: '💳' }

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg p-2.5 shadow text-xs">
      <p className="font-bold text-text mb-0.5">{label}</p>
      <p className="text-green2 font-bold">{formatINR(payload[0]?.value)}</p>
    </div>
  )
}

const DowTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg p-2.5 shadow text-xs">
      <p className="font-bold text-text mb-0.5">{label}</p>
      <p className="text-blue font-bold">{payload[0]?.value} orders</p>
      {payload[1] && <p className="text-green2 font-bold">{formatINR(payload[1]?.value)}</p>}
    </div>
  )
}

const EXPORT_PERIODS = [
  { key: 'today',  label: 'Today'      },
  { key: 'week',   label: 'This Week'  },
  { key: 'month',  label: 'This Month' },
  { key: 'year',   label: 'This Year'  },
  { key: 'all',    label: 'All'        },
  { key: 'custom', label: 'Custom'     },
]

function getExportRange(exportPeriod, customFrom, customTo) {
  const now = new Date()
  // Use local date parts so "Today" matches the user's calendar day
  const pad = n => String(n).padStart(2, '0')
  const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = localDate(now)
  switch (exportPeriod) {
    case 'today': return { from: today, to: today }
    case 'week':  { const s = new Date(now); s.setDate(now.getDate() - 6); return { from: localDate(s), to: today } }
    case 'month': return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today }
    case 'year':  return { from: `${now.getFullYear()}-01-01`, to: today }
    case 'all':   return { from: null, to: null }
    default:      return { from: customFrom, to: customTo }
  }
}

function fmtRange(from, to) {
  const d = s => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return from === to ? d(from) : `${d(from)} — ${d(to)}`
}

export default function Reports() {
  const [period, setPeriod]       = useState('today')
  const [exporting, setExporting] = useState(false)
  const [exportingGST, setExportingGST]   = useState(false)
  const [exportingInv, setExportingInv]   = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)
  const [exportPeriod, setExportPeriod] = useState('month')
  const [customFrom,   setCustomFrom]   = useState(todayStr)
  const [customTo,     setCustomTo]     = useState(todayStr)

  const exportCSV = async () => {
    const { from, to } = getExportRange(exportPeriod, customFrom, customTo)
    if (exportPeriod === 'custom' && (!from || !to)) { toast.error('Select a valid date range'); return }
    try {
      setExporting(true)
      toast.loading('Preparing export...', { id: 'export' })
      const allOrders = await getOrders({ limit: 10000 })

      // Filter by local date (IST) on the frontend — reliable regardless of backend timezone issues
      const pad = n => String(n).padStart(2, '0')
      const localDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const orders = allOrders.filter(o => {
        if (!from && !to) return true
        const orderDate = localDateStr(new Date(o.created_at))
        if (from && orderDate < from) return false
        if (to   && orderDate > to)   return false
        return true
      })

      // Summary totals
      const totSubtotal  = orders.reduce((s, o) => s + (o.subtotal || 0), 0)
      const totGST       = orders.reduce((s, o) => s + (o.gst_amount || 0), 0)
      const totDiscount  = orders.reduce((s, o) => s + (o.discount_amount || 0), 0)
      const totRevenue   = orders.reduce((s, o) => s + (o.total_amount || 0), 0)

      const rows = [
        ...csvHeader('BillByte — Orders Report', from, to),
        ['SUMMARY', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['Total Orders', orders.length, '', 'Gross Revenue (₹)', inr(totRevenue), '', 'Total GST (₹)', inr(totGST), '', 'Discounts (₹)', inr(totDiscount), '', ''],
        [],
        ['#', 'Order No.', 'Date', 'Time', 'Type', 'Table', 'Customer', 'Items', 'Subtotal (₹)', 'GST (₹)', 'Discount (₹)', 'Total (₹)', 'Payment', 'Status'],
      ]

      orders.forEach((o, idx) => {
        const d = new Date(o.created_at)
        rows.push([
          idx + 1,
          o.order_number,
          d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          (o.order_type || '').replace('_', ' '),
          o.table_number || '—',
          o.customer_name || '—',
          (o.items || []).map(i => `${i.name} ×${i.quantity}`).join(' | '),
          inr(o.subtotal),
          inr(o.gst_amount),
          inr(o.discount_amount),
          inr(o.total_amount),
          (o.payment_method || '—').toUpperCase(),
          (o.status || '').toUpperCase(),
        ])
      })

      rows.push([])
      rows.push(['', '', '', '', '', '', '', 'TOTAL', inr(totSubtotal), inr(totGST), inr(totDiscount), inr(totRevenue), '', ''])

      const suffix = from ? `${from}-to-${to}` : 'all'
      download('﻿' + toCSV(rows), `BillByte-Orders-${suffix}.csv`, 'text/csv;charset=utf-8;')
      toast.success(`✅ ${orders.length} orders exported`, { id: 'export' })
    } catch (e) { toast.error('Export failed', { id: 'export' })
    } finally { setExporting(false) }
  }

  const exportGST = async () => {
    const { from, to } = getExportRange(exportPeriod, customFrom, customTo)
    if (exportPeriod === 'custom' && (!from || !to)) { toast.error('Select a valid date range'); return }
    try {
      setExportingGST(true)
      toast.loading('Preparing GST report...', { id: 'gst' })

      // Fetch all paid orders and filter client-side
      const pad = n => String(n).padStart(2, '0')
      const localDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const allOrders = await getOrders({ limit: 10000 })
      const filtered = allOrders.filter(o => {
        if (!from && !to) return true
        if (o.payment_status !== 'paid') return false
        const orderDate = localDateStr(new Date(o.created_at))
        if (from && orderDate < from) return false
        if (to   && orderDate > to)   return false
        return true
      })

      const totTaxable = filtered.reduce((s, o) => s + (o.subtotal || 0), 0)
      const totGst     = filtered.reduce((s, o) => s + (o.gst_amount || 0), 0)

      const rows = [
        ...csvHeader('BillByte — GST Summary Report', from, to),
        ['SUMMARY', '', '', '', '', '', '', '', '', ''],
        ['Total Orders', filtered.length, '', 'Taxable Value (₹)', inr(totTaxable), '', 'Total GST (₹)', inr(totGst), '', ''],
        ['CGST @ 2.5% (₹)', inr(totGst / 2), '', 'SGST @ 2.5% (₹)', inr(totGst / 2), '', '', '', '', ''],
        [],
        ['#', 'Order No.', 'Date', 'Time', 'Order Type', 'Taxable Value (₹)', 'GST @ 5% (₹)', 'CGST @ 2.5% (₹)', 'SGST @ 2.5% (₹)', 'Total (₹)', 'Payment'],
        ...filtered.map((o, i) => {
          const d = new Date(o.created_at)
          const gst = o.gst_amount || 0
          return [
            i + 1, o.order_number,
            d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            (o.order_type || '').replace('_', ' '),
            inr(o.subtotal), inr(gst), inr(gst / 2), inr(gst / 2), inr(o.total_amount),
            (o.payment_method || '—').toUpperCase(),
          ]
        }),
        [],
        ['', '', '', '', 'TOTAL', inr(totTaxable), inr(totGst), inr(totGst / 2), inr(totGst / 2), '', ''],
      ]

      const suffix = from ? `${from}-to-${to}` : 'all'
      download('﻿' + toCSV(rows), `BillByte-GST-${suffix}.csv`, 'text/csv;charset=utf-8;')
      toast.success(`✅ GST report exported — ${filtered.length} orders`, { id: 'gst' })
    } catch { toast.error('GST export failed', { id: 'gst' })
    } finally { setExportingGST(false) }
  }

  const exportInventory = async () => {
    try {
      setExportingInv(true)
      toast.loading('Preparing inventory report...', { id: 'inv' })
      const data = await client.get('/reports/inventory-report')
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

      const rows = [
        ['BillByte — Inventory Snapshot', '', '', '', '', '', '', '', ''],
        [`Snapshot Date: ${today}`],
        [`Exported on: ${new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`],
        [],
        ['SUMMARY', '', '', '', '', '', '', '', ''],
        ['Total Items', data.total_items, '', 'Total Stock Value (₹)', inr(data.total_value), '', 'Low Stock Items', data.low_stock_count, ''],
        [],
        ['#', 'Item Name', 'Category', 'Quantity', 'Unit', 'Min Qty', 'Cost/Unit (₹)', 'Stock Value (₹)', 'Status', 'Expiry Date'],
        ...data.items.map((i, idx) => [
          idx + 1, i.name, i.category || '—', i.quantity, i.unit,
          i.min_quantity, inr(i.cost_per_unit), inr(i.stock_value),
          i.status, i.expiry_date || '—',
        ]),
      ]

      download('﻿' + toCSV(rows), `BillByte-Inventory-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;')
      toast.success(`✅ Inventory exported — ${data.total_items} items`, { id: 'inv' })
    } catch { toast.error('Inventory export failed', { id: 'inv' })
    } finally { setExportingInv(false) }
  }

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['sales', period],
    queryFn: () => getSalesReport(period),
  })
  const { data: topDishes } = useQuery({
    queryKey: ['topDishes', period],
    queryFn: () => getTopDishes(period),
  })
  const trendDays = period === 'month' ? 30 : 7

  const { data: trend } = useQuery({
    queryKey: ['trend', period],
    queryFn: () => getRevenueTrend(trendDays),
  })
  const chartData = (trend || []).map(d => ({
    name: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: d.revenue,
  }))

  const dowData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const buckets = days.map(day => ({ day, orders: 0, revenue: 0 }))
    for (const d of (trend || [])) {
      const dow = new Date(d.date).getDay()
      buckets[dow].orders += d.orders
      buckets[dow].revenue += d.revenue
    }
    return buckets
  }, [trend])

  const pieData = sales?.by_order_type
    ? Object.entries(sales.by_order_type).map(([name, value]) => ({ name: name.replace('_', '-'), value }))
    : []

  const paymentEntries = sales?.by_payment_method
    ? Object.entries(sales.by_payment_method).filter(([, c]) => c > 0).sort(([, a], [, b]) => b - a)
    : []
  const totalPaymentOrders = paymentEntries.reduce((s, [, c]) => s + c, 0)

  const kpis = [
    { label: 'Gross Revenue',   val: formatINR(sales?.revenue),         color: 'green'  },
    { label: 'Total Orders',    val: sales?.orders ?? '—',              color: 'blue'   },
    { label: 'GST Collected',   val: formatINR(sales?.gst_collected),   color: 'amber'  },
    { label: 'Avg Bill Value',  val: formatINR(sales?.avg_bill),        color: 'orange' },
    { label: 'Discounts Given', val: formatINR(sales?.discounts_given), color: 'purple' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display font-bold text-text">Reports</h2>
          <p className="text-xs text-muted">Sales analytics & business insights</p>
        </div>
        <div className="flex gap-1 bg-surface2 p-1 rounded-lg ml-auto">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${period === p ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Export Reports — full width */}
      <Card>
        <div className="flex flex-wrap items-start gap-6">
          {/* Left: title + period + date pickers */}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-sm text-text mb-1">Export Reports</h3>
            <p className="text-xs text-muted mb-3">Select a period then download as CSV</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {EXPORT_PERIODS.map(ep => (
                <button key={ep.key} onClick={() => setExportPeriod(ep.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    exportPeriod === ep.key
                      ? 'bg-green text-white border-green'
                      : 'bg-surface2 text-muted border-border hover:text-text'
                  }`}>
                  {ep.label}
                </button>
              ))}
            </div>
            {exportPeriod === 'custom' && (
              <div className="flex items-center gap-2 mb-3">
                <input type="date" value={customFrom} max={customTo}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-surface text-text focus:outline-none focus:border-green/50" />
                <span className="text-muted text-xs">to</span>
                <input type="date" value={customTo} min={customFrom}
                  onChange={e => setCustomTo(e.target.value)}
                  className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-surface text-text focus:outline-none focus:border-green/50" />
              </div>
            )}
            {(() => {
              const { from, to } = getExportRange(exportPeriod, customFrom, customTo)
              const label = !from ? 'All orders — no date filter' : fmtRange(from, to)
              return <p className="text-[11px] text-muted bg-surface2 rounded-lg px-3 py-1.5 inline-block">{label}</p>
            })()}
          </div>

          {/* Right: download buttons */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <button onClick={exportCSV} disabled={exporting}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface2 border border-border hover:border-green/40 hover:bg-green-dim transition-all disabled:opacity-50">
              <span className="text-lg">📊</span>
              <div className="text-left">
                <p className="text-xs font-semibold text-text">Orders</p>
                <p className="text-[10px] text-muted">{exporting ? 'Exporting…' : 'CSV'}</p>
              </div>
            </button>
            <button onClick={exportGST} disabled={exportingGST}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface2 border border-border hover:border-blue/40 hover:bg-blue-dim transition-all disabled:opacity-50">
              <span className="text-lg">🧾</span>
              <div className="text-left">
                <p className="text-xs font-semibold text-text">GST Summary</p>
                <p className="text-[10px] text-muted">{exportingGST ? 'Exporting…' : 'CSV'}</p>
              </div>
            </button>
            <button onClick={exportInventory} disabled={exportingInv}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface2 border border-border hover:border-orange/40 hover:bg-orange-dim transition-all disabled:opacity-50">
              <span className="text-lg">📦</span>
              <div className="text-left">
                <p className="text-xs font-semibold text-text">Inventory</p>
                <p className="text-[10px] text-muted">{exportingInv ? 'Exporting…' : 'CSV'}</p>
              </div>
            </button>
          </div>
        </div>
      </Card>

      {/* KPI row */}
      {salesLoading
        ? <div className="flex justify-center py-6"><Spinner /></div>
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map(k => (
              <Card key={k.label}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">{k.label}</p>
                <p className="font-display font-black text-2xl" style={{ color: `var(--${k.color})` }}>{k.val}</p>
              </Card>
            ))}
          </div>
        )}

      {/* Charts row 1: Revenue trend + Order type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-display font-bold text-sm text-text mb-4">Revenue — Last {trendDays} Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={trendDays <= 7 ? 28 : 8}>
              <CartesianGrid strokeDasharray="3 0" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={trendDays <= 7 ? 0 : 4} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--surface2)' }} />
              <Bar dataKey="revenue" fill="var(--green)" radius={[4,4,0,0]} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-display font-bold text-sm text-text mb-4">By Order Type</h3>
          {pieData.length > 0
            ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                       dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatINR(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )
            : <div className="flex items-center justify-center h-48 text-sm text-muted">No data yet</div>}
        </Card>
      </div>

      {/* Charts row 2: Day of week + Payment methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-display font-bold text-sm text-text mb-4">
            Busiest Days
            <span className="ml-2 text-[10px] font-normal text-muted">Last {trendDays} days</span>
          </h3>
          {dowData.some(d => d.orders > 0)
            ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dowData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 0" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DowTooltip />} cursor={{ fill: 'var(--surface2)' }} />
                  <Bar dataKey="orders" fill="var(--blue)" radius={[4,4,0,0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )
            : <div className="flex items-center justify-center h-36 text-sm text-muted">No data yet</div>}
        </Card>

        <Card>
          <h3 className="font-display font-bold text-sm text-text mb-4">Payment Methods</h3>
          {paymentEntries.length > 0
            ? (
              <div className="space-y-4 mt-1">
                {paymentEntries.map(([method, count]) => {
                  const pct = totalPaymentOrders ? Math.round(count / totalPaymentOrders * 100) : 0
                  const color = PAYMENT_COLORS[method] || '#6b7280'
                  const emoji = PAYMENT_EMOJI[method] || '💰'
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-text capitalize">{emoji} {method}</span>
                        <span className="text-muted">{count} orders · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
            : <div className="flex items-center justify-center h-36 text-sm text-muted">No data for this period</div>}
        </Card>
      </div>

      {/* Top Dishes — full width */}
      <Card>
        <h3 className="font-display font-bold text-sm text-text mb-4">Top Dishes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {(topDishes || []).slice(0, 10).map((d, i) => {
            const max = topDishes[0]?.quantity || 1
            return (
              <div key={d.name} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-dim text-amber' : 'bg-surface2 text-muted'}`}>{i + 1}</span>
                <p className="flex-1 text-xs font-medium text-text2 truncate">{d.name}</p>
                <span className="text-xs font-bold text-text flex-shrink-0">{d.quantity}×</span>
                <span className="text-xs text-muted flex-shrink-0 w-16 text-right">{formatINR(d.revenue)}</span>
                <div className="w-16 h-1.5 bg-surface2 rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full bg-green rounded-full" style={{ width: `${Math.round(d.quantity / max * 100)}%` }} />
                </div>
              </div>
            )
          })}
          {(!topDishes || topDishes.length === 0) && (
            <div className="text-center text-sm text-muted py-6 col-span-2">No orders for this period</div>
          )}
        </div>
      </Card>
    </div>
  )
}
