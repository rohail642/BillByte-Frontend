import Modal from './Modal'
import Button from './Button'
import { Printer } from 'lucide-react'

const Sep = () => (
  <div style={{ borderTop: '1px dashed #555', margin: '6px 0' }} />
)

export default function KOTView({ data }) {
  const { restaurantName, orderNumber, tableNumber, customerName, items = [], notes } = data

  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const s = {
    wrap:   { fontFamily: "'Courier New', Courier, monospace", fontSize: 12, width: '70mm', maxWidth: '70mm', margin: '0 auto', padding: '12px 14px', color: '#111', background: '#fff' },
    center: { textAlign: 'center' },
    bold:   { fontWeight: 700 },
    muted:  { color: '#555' },
    sm:     { fontSize: 11 },
    row:    { display: 'flex', justifyContent: 'space-between', marginBottom: 2 },
  }

  return (
    <div id="kot-print-area" style={s.wrap}>

      {/* Header */}
      <div style={{ ...s.center, marginBottom: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 3 }}>KOT</div>
        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
          {restaurantName || 'Restaurant'}
        </div>
      </div>

      <Sep />

      {/* Meta */}
      <div style={{ ...s.sm, marginBottom: 4 }}>
        <div style={s.row}>
          <span>{tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'}</span>
          {orderNumber && <span style={s.bold}>#{orderNumber}</span>}
        </div>
        {customerName?.trim() && (
          <div style={{ ...s.bold, fontSize: 13, marginTop: 2 }}>Name: {customerName.trim()}</div>
        )}
        <div style={{ ...s.muted }}>
          {dateStr} &nbsp; {timeStr}
        </div>
      </div>

      <Sep />

      {/* Items */}
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ ...s.bold, borderBottom: '1px solid #111' }}>
            <th style={{ textAlign: 'center', paddingBottom: 4, width: 36 }}>QTY</th>
            <th style={{ textAlign: 'left',   paddingBottom: 4 }}>ITEM</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px dashed #ccc' }}>
              <td style={{ textAlign: 'center', paddingTop: 5, paddingBottom: 5, fontWeight: 700, fontSize: 13 }}>
                {item.quantity}
              </td>
              <td style={{ paddingTop: 5, paddingBottom: 5 }}>{item.name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sep />

      {notes?.trim() && (
        <>
          <div style={{ ...s.sm }}>
            <span style={s.bold}>Notes: </span>{notes.trim()}
          </div>
          <Sep />
        </>
      )}

    </div>
  )
}

export function printKOTContent(data) {
  const { restaurantName, orderNumber, tableNumber, customerName, items = [], notes } = data
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const tableLabel = tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'
  const orderLabel = orderNumber ? `<span style="font-weight:700">#${orderNumber}</span>` : ''
  const nameHtml = customerName?.trim()
    ? `<div style="font-weight:700;font-size:13px;margin-top:2px">Name: ${customerName.trim()}</div>`
    : ''
  const SEP = `<div style="border-top:1px dashed #555;margin:6px 0"></div>`

  const rows = items.map(i => `
    <tr style="border-bottom:1px dashed #ccc">
      <td style="text-align:center;padding:5px;font-weight:700;font-size:13px;width:36px">${i.quantity}</td>
      <td style="padding:5px">${i.name}</td>
    </tr>`).join('')

  const notesHtml = notes?.trim()
    ? `${SEP}<div style="font-size:11px"><b>Notes: </b>${notes.trim()}</div>`
    : ''

  const html = `<html><head><title>KOT</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      @page { size: 80mm auto; margin: 3mm 5mm; }
      body { font-family:'Courier New',Courier,monospace; font-size:11px; width:70mm; padding:4px 0; }
      @media print { body { padding:0; } }
    </style></head><body>
    <div style="text-align:center;margin-bottom:8px">
      <div style="font-weight:900;font-size:20px;letter-spacing:3px">KOT</div>
      <div style="font-weight:700;font-size:13px;margin-top:2px">${restaurantName || ''}</div>
    </div>
    ${SEP}
    <div style="font-size:11px;margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px">
        <span>${tableLabel}</span>${orderLabel}
      </div>
      ${nameHtml}
      <div style="color:#555">${dateStr} &nbsp; ${timeStr}</div>
    </div>
    ${SEP}
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <thead><tr style="font-weight:700;border-bottom:1px solid #111">
        <th style="text-align:center;padding-bottom:4px;width:36px">QTY</th>
        <th style="text-align:left;padding-bottom:4px">ITEM</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${SEP}${notesHtml}
    </body></html>`

  const win = window.open('', '_blank', 'width=320,height=600')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

export function KOTModal({ data, onClose }) {
  if (!data) return null
  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title="🍽️ KOT"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<Printer size={14} />} onClick={() => { onClose(); setTimeout(() => printKOTContent(data), 100) }}>
            Print KOT
          </Button>
        </>
      }
    >
      <KOTView data={data} />
    </Modal>
  )
}
