import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSalesReport, getTopDishes, getRevenueTrend } from '../api/reports'
import { getOrders } from '../api/orders'
import client from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { formatINR } from '../utils'
import { Download } from 'lucide-react'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

const PERIODS = ['today', 'week', 'month']
const COLORS  = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#d97706']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg p-2.5 shadow text-xs">
      <p className="font-bold text-text mb-0.5">{label}</p>
      <p className="text-green2 font-bold">{formatINR(payload[0]?.value)}</p>
    </div>
  )
}

export default function Reports() {
  const [period, setPeriod] = useState('today')
  const [exporting, setExporting] = useState(false)

  const exportCSV = async () => {
    try {
      setExporting(true)
      toast.loading('Preparing export...', { id: 'export' })

      const orders = await getOrders({ limit: 1000 })

      // Build CSV rows
      const rows = [
        ['Order Number', 'Date', 'Time', 'Type', 'Table', 'Customer', 'Items', 'Subtotal', 'GST', 'Discount', 'Total', 'Payment', 'Status'],
      ]

      for (const o of orders) {
        const date = new Date(o.created_at)
        const itemNames = (o.items || []).map(i => `${i.name}x${i.quantity}`).join(' | ')
        rows.push([
          o.order_number,
          `${date.getDate().toString().padStart(2,'0')}-${date.toLocaleString('en',{month:'short'})}-${date.getFullYear()}`,
          date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          o.order_type?.replace('_', ' '),
          o.table_number || '',
          o.customer_name || '',
          itemNames,
          o.subtotal || '',
          o.gst_amount || '',
          o.discount_amount || '',
          o.total_amount,
          o.payment_method || '',
          o.status,
        ])
      }

      // BOM ensures Excel opens with correct encoding
      // Prefix phone numbers with tab to prevent scientific notation
      const csv = rows.map((r, ri) => r.map((v, ci) => {
        const s = String(v)
        // Phone number column (index 5 = Customer) — force text in Excel
        if (ri > 0 && ci === 5 && s.match(/^[\d+]/)) return `"'${s}"`
        return `"${s.replace(/"/g, '""')}"`
      }).join(',')).join('\n')
      const BOM  = '\uFEFF'
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `billbyte-orders-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`✅ Exported ${orders.length} orders!`, { id: 'export' })
    } catch (e) {
      toast.error('Export failed', { id: 'export' })
    } finally {
      setExporting(false)
    }
  }

  const exportGST = async () => {
    try {
      toast.loading('Preparing GST report...', { id: 'gst' })
      const today = new Date()
      const res = await client.get('/reports/gst-summary', {
        params: { month: today.getMonth() + 1, year: today.getFullYear() }
      })
      const data = res

      const rows = [
        [`GST Summary — ${data.month}/${data.year}`],
        [`Total Orders: ${data.total_orders}`, `Total Taxable Value: ${data.total_taxable_value}`, `Total GST: ${data.total_gst}`, `CGST: ${data.cgst}`, `SGST: ${data.sgst}`],
        [],
        ['Order Number', 'Date', 'Time', 'Type', 'Taxable Value', 'GST (5%)', 'CGST (2.5%)', 'SGST (2.5%)', 'Total', 'Payment'],
        ...data.orders.map(o => [
          o.order_number, o.date, o.time, o.order_type,
          o.taxable_value, o.gst, o.cgst, o.sgst, o.total, o.payment
        ])
      ]

      const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `billbyte-gst-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`✅ GST report exported — ${data.total_orders} orders`, { id: 'gst' })
    } catch(e) { toast.error('GST export failed', { id: 'gst' }) }
  }

  const exportInventory = async () => {
    try {
      toast.loading('Preparing inventory report...', { id: 'inv' })
      const data = await client.get('/reports/inventory-report')

      const rows = [
        [`Inventory Report — ${new Date().toLocaleDateString('en-IN')}`],
        [`Total Items: ${data.total_items}`, `Total Stock Value: ₹${data.total_value}`, `Low Stock Items: ${data.low_stock_count}`],
        [],
        ['Item Name', 'Category', 'Quantity', 'Unit', 'Min Qty', 'Cost/Unit (₹)', 'Stock Value (₹)', 'Status', 'Expiry Date'],
        ...data.items.map(i => [
          i.name, i.category, i.quantity, i.unit,
          i.min_quantity, i.cost_per_unit, i.stock_value, i.status, i.expiry_date
        ])
      ]

      const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `billbyte-inventory-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`✅ Inventory exported — ${data.total_items} items`, { id: 'inv' })
    } catch(e) { toast.error('Inventory export failed', { id: 'inv' }) }
  }

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['sales', period],
    queryFn: () => getSalesReport(period),
  })
  const { data: topDishes } = useQuery({
    queryKey: ['topDishes', period],
    queryFn: () => getTopDishes(period),
  })
  const { data: trend } = useQuery({
    queryKey: ['trend30'],
    queryFn: () => getRevenueTrend(30),
  })

  const chartData = (trend || []).map(d => ({
    name: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: d.revenue,
    orders: d.orders,
  }))

  const pieData = sales?.by_order_type
    ? Object.entries(sales.by_order_type).map(([name, value]) => ({ name: name.replace('_', '-'), value }))
    : []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display font-bold text-text">Reports</h2>
          <p className="text-xs text-muted">150+ automated business reports</p>
        </div>
        <div className="flex gap-1 bg-surface2 p-1 rounded-lg ml-auto">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${period === p ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              {p}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={<Download size={13} />}
          onClick={exportCSV} loading={exporting}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* KPI row */}
      {salesLoading
        ? <div className="flex justify-center py-6"><Spinner /></div>
        : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Gross Revenue',    val: formatINR(sales?.revenue),          color: 'green'  },
              { label: 'Total Orders',     val: sales?.orders ?? '—',               color: 'blue'   },
              { label: 'GST Collected',    val: formatINR(sales?.gst_collected),    color: 'amber'  },
              { label: 'Avg Bill Value',   val: formatINR(sales?.avg_bill),         color: 'orange' },
            ].map(k => (
              <Card key={k.label}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">{k.label}</p>
                <p className="font-display font-black text-2xl" style={{ color: `var(--${k.color})` }}>{k.val}</p>
              </Card>
            ))}
          </div>
        )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <Card className="lg:col-span-2">
          <h3 className="font-display font-bold text-sm text-text mb-4">Revenue — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={8}>
              <CartesianGrid strokeDasharray="3 0" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface2)' }} />
              <Bar dataKey="revenue" fill="var(--green)" radius={[4,4,0,0]} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Order type pie */}
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

      {/* Top dishes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-display font-bold text-sm text-text mb-4">Top Dishes</h3>
          <div className="space-y-3">
            {(topDishes || []).slice(0, 8).map((d, i) => {
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
          </div>
        </Card>

        {/* Report cards */}
        <Card>
          <h3 className="font-display font-bold text-sm text-text mb-1">Download Reports</h3>
          <p className="text-xs text-muted mb-4">All reports export as CSV — open directly in Excel or Google Sheets</p>
          <div className="space-y-2">
            {/* Orders CSV */}
            <button onClick={exportCSV} disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border hover:border-green/30 hover:bg-green-dim transition-all text-left group">
              <div className="text-2xl">📊</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">All Orders Report</p>
                <p className="text-xs text-muted">Every order with items, totals, payment method, customer</p>
              </div>
              <div className="flex-shrink-0">
                <Badge color="green">CSV</Badge>
              </div>
            </button>

            {/* GST Summary */}
            <button onClick={exportGST}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border hover:border-green/30 hover:bg-green-dim transition-all text-left group">
              <div className="text-2xl">🧾</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">GST Summary — This Month</p>
                <p className="text-xs text-muted">CGST + SGST breakup per order, ready for filing</p>
              </div>
              <div className="flex-shrink-0">
                <Badge color="blue">CSV</Badge>
              </div>
            </button>

            {/* Inventory */}
            <button onClick={exportInventory}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border hover:border-green/30 hover:bg-green-dim transition-all text-left group">
              <div className="text-2xl">📦</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">Inventory Snapshot</p>
                <p className="text-xs text-muted">Current stock levels, values, low stock & expiry status</p>
              </div>
              <div className="flex-shrink-0">
                <Badge color="orange">CSV</Badge>
              </div>
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}