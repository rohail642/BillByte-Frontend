const PAY_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card' }

const Sep = ({ double }) => (
  <div style={{
    borderTop: double ? '3px double #111' : '1px dashed #555',
    margin: '6px 0',
  }} />
)

export default function ReceiptView({ order, profile }) {
  const r = profile || {}
  const gstRate   = r.gst_rate ?? 5
  const halfRate  = (gstRate / 2).toFixed(1)
  const halfAmt   = ((order.gst_amount || 0) / 2).toFixed(2)

  const items = (() => {
    const grouped = []
    ;(order.items || []).filter(item => !item.cancelled_at).forEach(item => {
      const ex = grouped.find(g => g.name === item.name && g.price === item.price)
      if (ex) { ex.quantity += item.quantity; ex.total += item.total }
      else grouped.push({ ...item })
    })
    return grouped
  })()

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const dt = new Date(order.created_at)
  const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/')
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const orderTypeLabel = {
    dine_in:  'Dine-In',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
    zomato:   'Zomato',
    swiggy:   'Swiggy',
    whatsapp: 'WhatsApp',
  }[order.order_type] || order.order_type || ''

  const s = {
    wrap:   { fontFamily: "'Courier New', Courier, monospace", fontSize: 12, width: '70mm', maxWidth: '70mm', margin: '0 auto', padding: '12px 14px', color: '#111', background: '#fff' },
    center: { textAlign: 'center' },
    right:  { textAlign: 'right' },
    row:    { display: 'flex', justifyContent: 'space-between', marginBottom: 2 },
    bold:   { fontWeight: 700 },
    muted:  { color: '#555' },
    sm:     { fontSize: 11 },
    xs:     { fontSize: 10 },
  }

  return (
    <div id="receipt-print-area" style={s.wrap}>

      {/* ── Header ── */}
      <div style={{ ...s.center, marginBottom: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.5 }}>
          {r.restaurant_name || 'BillByte Restaurant'}
        </div>
        {r.phone   && <div style={{ ...s.sm, marginTop: 2 }}>PH: {r.phone}</div>}
        {r.address && <div style={{ ...s.sm, marginTop: 2 }}>{r.address}</div>}
        {r.city    && <div style={s.sm}>{r.city}</div>}
        {r.fssai   && <div style={s.sm}>FSSAI: {r.fssai}</div>}
        {r.gstin   && <div style={s.sm}>GSTIN: {r.gstin}</div>}
      </div>

      <Sep double />

      {/* ── Order meta ── */}
      <div style={{ ...s.sm, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Date: {dateStr} {timeStr}</span>
          <span style={s.bold}>{orderTypeLabel}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Bill No: <span style={s.bold}>#{order.order_number}</span></span>
          {order.table_number && <span>Table: <span style={s.bold}>{order.table_number}</span></span>}
        </div>
        {order.customer_phone && (
          <div style={{ marginTop: 2 }}>
            Mob: <span style={s.bold}>{order.customer_phone}</span>
          </div>
        )}
        {order.customer_name && (
          <div style={{ marginTop: 2 }}>
            Customer: <span style={s.bold}>{order.customer_name}</span>
          </div>
        )}
        {order.payment_method && (
          <div style={{ marginTop: 3 }}>
            Payment: <span style={s.bold}>{PAY_LABELS[order.payment_method] || order.payment_method}</span>
          </div>
        )}
      </div>

      <Sep double />

      {/* ── Items table ── */}
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ ...s.bold, borderBottom: '1px solid #111' }}>
            <th style={{ textAlign: 'left',   paddingBottom: 4, width: 22 }}>#</th>
            <th style={{ textAlign: 'left',   paddingBottom: 4 }}>Item</th>
            <th style={{ textAlign: 'center', paddingBottom: 4, width: 30 }}>Qty</th>
            <th style={{ textAlign: 'right',  paddingBottom: 4, width: 52 }}>Rate</th>
            <th style={{ textAlign: 'right',  paddingBottom: 4, width: 52 }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px dashed #ccc' }}>
              <td style={{ paddingTop: 4, paddingBottom: 4, ...s.muted }}>{i + 1}</td>
              <td style={{ paddingTop: 4, paddingBottom: 4 }}>{item.name}</td>
              <td style={{ textAlign: 'center', paddingTop: 4, paddingBottom: 4 }}>{item.quantity}</td>
              <td style={{ textAlign: 'right',  paddingTop: 4, paddingBottom: 4, ...s.muted }}>{Number(item.price).toFixed(2)}</td>
              <td style={{ textAlign: 'right',  paddingTop: 4, paddingBottom: 4, ...s.bold }}>{Number(item.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sep />

      {/* ── Totals ── */}
      <div style={s.sm}>
        <div style={{ ...s.row, ...s.muted }}>
          <span>Total Qty: {totalQty}</span>
          <span>Sub Total: {Number(order.subtotal).toFixed(2)}</span>
        </div>
        <div style={{ ...s.row, ...s.muted }}>
          <span>CGST ({halfRate}%)</span>
          <span>{halfAmt}</span>
        </div>
        <div style={{ ...s.row, ...s.muted }}>
          <span>SGST ({halfRate}%)</span>
          <span>{halfAmt}</span>
        </div>
        {order.discount_amount > 0 && (
          <div style={{ ...s.row, ...s.muted }}>
            <span>Discount</span>
            <span>-{Number(order.discount_amount).toFixed(2)}</span>
          </div>
        )}
      </div>

      <Sep double />

      <div style={{ ...s.row, ...s.bold, fontSize: 14 }}>
        <span>Grand Total</span>
        <span>₹ {Number(order.total_amount).toFixed(2)}</span>
      </div>

      <Sep double />

      {/* ── Footer ── */}
      <div style={{ ...s.center, ...s.sm, marginTop: 8 }}>
        <div style={{ ...s.bold, fontSize: 13, marginBottom: 3 }}>Thank You, Visit Again!</div>
        <div style={{ ...s.xs, ...s.muted, marginTop: 6 }}>Powered by BillByte</div>
      </div>

    </div>
  )
}

export function printReceipt() {
  const content = document.getElementById('receipt-print-area')
  if (!content) return
  const win = window.open('', '_blank', 'width=320,height=750')
  win.document.write(`<html><head><title>Receipt</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: 80mm auto; margin: 3mm 5mm; }
      body { font-family: 'Courier New', Courier, monospace; width: 70mm; padding: 4px 0; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>${content.innerHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
