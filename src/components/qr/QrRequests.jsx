// Guest table-QR orders waiting for staff confirmation.
// Shown in two places: the slide-out panel opened from the Topbar (any page)
// and a strip at the top of the Orders page. Both share the cards below.
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, X, Clock, QrCode, BellRing, Receipt } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import { KOTModal } from '../ui/KOTView'
import { useAuthStore } from '../../store/auth'
import { formatINR, timeAgo, printKOTElectron, isNativeApp } from '../../utils'
import { acceptQrRequest, rejectQrRequest, finishQrCall } from '../../api/tableOrdering'
import { usePendingQr, qrBeep } from './usePendingQr'

function RequestCard({ r, onAccept, onReject, accepting, busy }) {
  return (
    <div className="bg-surface border border-amber/40 rounded-xl p-3 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-base text-text">Table {r.table_number}</p>
          <p className="text-[11px] text-muted flex items-center gap-1 truncate">
            <Clock size={11} /> {timeAgo(r.created_at)}{r.guest_name ? ` · ${r.guest_name}` : ''}
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-text">{formatINR(r.subtotal)}</span>
      </div>
      <ul className="text-sm space-y-0.5 text-text2">
        {r.items.map((i, k) => (
          <li key={k}>
            <span className="font-semibold text-text">{i.quantity} ×</span> {i.name}
            {i.notes && <span className="block text-xs text-amber pl-5">{i.notes}</span>}
          </li>
        ))}
      </ul>
      {r.notes && <p className="text-xs bg-amber-dim text-amber rounded-lg px-2.5 py-1.5">Note: {r.notes}</p>}
      <div className="flex gap-2 mt-auto">
        <Button variant="danger" size="sm" className="flex-1" icon={<X size={14} />} disabled={busy} onClick={onReject}>Reject</Button>
        <Button variant="primary" size="sm" className="flex-[2]" icon={<Check size={14} />} loading={accepting} disabled={busy}
          onClick={onAccept}>Accept & send KOT</Button>
      </div>
    </div>
  )
}

// Cards + the accept/reject logic and their modals.
export function QrRequestCards({ requests, className, empty = null }) {
  const qc = useQueryClient()
  const restaurantName = useAuthStore(s => s.restaurantName)
  const [kotModal, setKotModal] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['qrRequests'] })
    qc.invalidateQueries({ queryKey: ['summary'] })
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['activeTables'] })
  }

  const accept = useMutation({
    mutationFn: r => acceptQrRequest(r.id).then(res => ({ res, r })),
    onSuccess: ({ res, r }) => {
      toast.success(`Table ${r.table_number} — sent to kitchen`)
      const kotData = {
        restaurantName: restaurantName || '',
        orderNumber: res.order_number,
        tableNumber: r.table_number,
        customerName: r.guest_name || '',
        items: r.items.map(i => ({ name: i.name, quantity: i.quantity })),
        notes: [r.notes, ...r.items.filter(i => i.notes).map(i => `${i.name}: ${i.notes}`)].filter(Boolean).join(' · '),
        orderId: res.order_id,
      }
      if (!printKOTElectron(kotData) && !isNativeApp()) setKotModal(kotData)
      refresh()
    },
    onError: e => { toast.error(e || 'Could not accept'); refresh() },
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }) => rejectQrRequest(id, reason),
    onSuccess: () => { toast('Order rejected'); setRejecting(null); setReason(''); refresh() },
    onError: e => { toast.error(e || 'Could not reject'); refresh() },
  })

  return (
    <>
      {requests.length === 0 ? empty : <div className={className}>
        {requests.map(r => (
          <RequestCard key={r.id} r={r}
            busy={accept.isPending}
            accepting={accept.isPending && accept.variables?.id === r.id}
            onAccept={() => accept.mutate(r)}
            onReject={() => setRejecting(r)} />
        ))}
      </div>}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject Table ${rejecting?.table_number} order?`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
          <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate({ id: rejecting.id, reason: reason.trim() || null })}>Reject order</Button>
        </>}>
        <Input label="Reason shown to the guest (optional)" value={reason} maxLength={200}
          onChange={e => setReason(e.target.value)} placeholder="e.g. Kitchen closed, item finished" />
      </Modal>

      <KOTModal data={kotModal} onClose={() => setKotModal(null)} />
    </>
  )
}

const PAY_LABEL = { cash: 'cash', upi: 'UPI', card: 'card' }

// "Call waiter" / "Ask for bill" taps from the guest page.
function CallCards({ calls }) {
  const qc = useQueryClient()
  const done = useMutation({
    mutationFn: id => finishQrCall(id),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['qrCalls'] }); qc.invalidateQueries({ queryKey: ['summary'] }) },
    onError: e => toast.error(e || 'Could not update'),
  })
  if (!calls.length) return null
  return (
    <div className="space-y-2">
      {calls.map(c => {
        const bill = c.kind === 'bill'
        const Icon = bill ? Receipt : BellRing
        return (
          <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 ${bill ? 'border-green/40 bg-green-dim/40' : 'border-blue/30 bg-blue-dim/40'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bill ? 'bg-green text-white' : 'bg-blue text-white'}`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-sm text-text">Table {c.table_number}</p>
              <p className="text-xs text-text2">
                {bill ? `Wants the bill${c.pay_by ? ` · paying by ${PAY_LABEL[c.pay_by]}` : ''}` : 'Calling a waiter'}
                <span className="text-muted"> · {timeAgo(c.created_at)}</span>
              </p>
            </div>
            <Button size="sm" variant="secondary" icon={<Check size={14} />}
              loading={done.isPending && done.variables === c.id} onClick={() => done.mutate(c.id)}>Done</Button>
          </div>
        )
      })}
    </div>
  )
}

// Slide-out panel with everything guests are waiting on: calls first, then orders.
export function QrInbox({ open, onClose, pollMs }) {
  const { requests, calls, isLoading } = usePendingQr({ pollMs })
  if (!open) return null
  const total = requests.length + calls.length
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative w-full sm:w-[400px] h-full bg-bg2 border-l border-border shadow-xl flex flex-col animate-fadeUp">
        <div className="flex items-center justify-between px-4 h-[60px] border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-amber" />
            <p className="font-display font-bold text-sm text-text">Tables waiting</p>
            {total > 0 && <span className="text-[11px] font-bold bg-amber-dim text-amber rounded-full px-2 py-0.5">{total}</span>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-text3 hover:text-text hover:bg-surface2"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && !total ? <div className="py-16 flex justify-center"><Spinner /></div> : <>
            <CallCards calls={calls} />
            <QrRequestCards requests={requests} className="space-y-3" empty={calls.length ? null :
              <div className="py-16 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold text-text">All caught up</p>
                <p className="text-xs text-muted">Accepted orders are in Orders with a QR tag.</p>
              </div>
            } />
          </>}
        </div>
      </aside>
    </div>
  )
}

// Pill + panel + beep/toast for anything new. Used by the Topbar (owner,
// manager, cashier) and the full-screen waiter view.
export function QrAlerts({ open, setOpen, pollMs, compact = false }) {
  const { count, callCount, requests, calls } = usePendingQr({ pollMs })
  const seen = useRef(null)
  useEffect(() => {
    const keys = [...requests.map(r => `r${r.id}`), ...calls.map(c => `c${c.id}`)]
    if (seen.current) {
      const fresh = keys.filter(k => !seen.current.has(k))
      if (fresh.length) {
        qrBeep()
        const call = calls.find(c => fresh.includes(`c${c.id}`))
        const msg = call
          ? `Table ${call.table_number} ${call.kind === 'bill' ? 'wants the bill' : 'is calling a waiter'}`
          : 'New table order'
        toast(t => (
          <span className="flex items-center gap-3 text-sm">
            {msg}
            <button className="font-bold text-green2 hover:underline" onClick={() => { setOpen(true); toast.dismiss(t.id) }}>View</button>
          </span>
        ), { id: 'qr-new', icon: call ? '🔔' : '📱', duration: 8000 })
      }
    }
    seen.current = new Set(keys)
  }, [requests, calls, setOpen])

  const total = count + callCount
  const label = [count && `${count} order${count > 1 ? 's' : ''}`, callCount && `${callCount} call${callCount > 1 ? 's' : ''}`]
    .filter(Boolean).join(' · ')
  return (
    <>
      {total > 0 && (
        <button onClick={() => setOpen(true)} title="Tables waiting"
          className="flex items-center gap-1.5 bg-amber-dim border border-amber/40 text-amber rounded-full px-3 py-1 text-[11px] font-bold hover:opacity-90 animate-pulse">
          {callCount > 0 ? <BellRing size={13} /> : <QrCode size={13} />}
          {compact ? total : label}
        </button>
      )}
      <QrInbox open={open} onClose={() => setOpen(false)} pollMs={pollMs} />
    </>
  )
}

// Strip pinned to the top of the Orders page; hidden when no orders are waiting.
// The cards stay mounted either way so the KOT preview survives accepting the last one.
export function QrPendingStrip() {
  const { requests } = usePendingQr()
  const show = requests.length > 0
  return (
    <div className={show ? 'rounded-2xl border border-amber/40 bg-amber-dim/40 p-3 space-y-3' : 'hidden'}>
      {show && (
        <div className="flex items-center gap-2">
          <QrCode size={15} className="text-amber" />
          <p className="font-display font-bold text-sm text-text">Waiting for confirmation</p>
          <span className="text-[11px] font-bold bg-amber-dim text-amber rounded-full px-2 py-0.5">{requests.length}</span>
          <span className="text-xs text-muted hidden sm:inline">· guests ordered by scanning the table QR</span>
        </div>
      )}
      <QrRequestCards requests={requests} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" />
    </div>
  )
}
