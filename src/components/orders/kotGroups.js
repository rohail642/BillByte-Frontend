// Split a running table bill into its order rounds (KOTs), each labelled with
// who placed it — a QR guest ("Riya", QR) or a staff member — and its note.
// Orders saved before kot_info existed just get "Order N".
export function kotGroups(order) {
  const info = order?.kot_info || {}
  const by = {}
  for (const it of order?.items || []) {
    const k = it.kot_number || 1
    ;(by[k] = by[k] || []).push(it)
  }
  return Object.keys(by).map(Number).sort((a, b) => a - b).map(k => {
    const m = info[String(k)] || {}
    return {
      kot: k, items: by[k], qr: m.by === 'qr', note: m.note || null,
      label: m.by === 'qr' ? (m.name || 'Guest') : (m.name || null),
    }
  })
}
