import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import toast from 'react-hot-toast'
import { Minus, Plus } from 'lucide-react'

const REASON_CODES = [
  { value: 'wrong_order', label: 'Wrong Order', desc: 'Item was ordered incorrectly' },
  { value: 'changed_mind', label: 'Customer Changed Mind', desc: 'Customer no longer wants this item' },
  { value: 'stock_out', label: 'Stock Out', desc: 'Ingredient unavailable' },
  { value: 'quality_issue', label: 'Quality Issue', desc: 'Food quality concern' },
  { value: 'other', label: 'Other', desc: 'Specify in note' },
]

export default function CancelItemModal({
  open,
  onClose,
  item,
  requiresApproval,
  onConfirm,
  isPending,
}) {
  const [reasonCode, setReasonCode] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [managerPin, setManagerPin] = useState('')
  const [cancelQty, setCancelQty] = useState(1)

  useEffect(() => {
    if (open && item) {
      setCancelQty(item.quantity || 1)
    }
  }, [open, item])

  function handleClose() {
    setReasonCode('')
    setReasonNote('')
    setManagerPin('')
    setCancelQty(1)
    onClose()
  }

  function handleConfirm() {
    if (!reasonCode) {
      toast.error('Please select a reason for cancellation')
      return
    }
    if (requiresApproval && !managerPin) {
      toast.error('Manager PIN is required to cancel a fired item')
      return
    }
    onConfirm({
      reason_code: reasonCode,
      reason_note: reasonNote || null,
      manager_pin: requiresApproval ? managerPin : null,
      quantity: cancelQty < (item?.quantity || 1) ? cancelQty : undefined,
    })
  }

  const isValid = reasonCode && (!requiresApproval || managerPin.length >= 4)

  return (
    <Modal open={open} onClose={handleClose} title="Cancel Item" size="sm">
      <div className="space-y-4">
        {/* Item info */}
        <div className="bg-surface2 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-text">{item?.name}</p>
          <p className="text-xs text-muted mt-0.5">Qty: {item?.quantity} × ₹{item?.price}</p>
          {requiresApproval && (
            <p className="text-[10px] font-bold text-red mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red inline-block" />
              This item has been sent to the kitchen — manager approval required
            </p>
          )}
        </div>

        {/* Quantity selector (only when qty > 1) */}
        {(item?.quantity || 1) > 1 && (
          <div>
            <label className="block text-xs font-semibold text-text2 mb-1.5">Quantity to cancel</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCancelQty(q => Math.max(1, q - 1))}
                disabled={cancelQty <= 1}
                className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center text-text hover:bg-border transition-colors disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="text-lg font-bold text-text w-8 text-center tabular-nums">{cancelQty}</span>
              <button
                type="button"
                onClick={() => setCancelQty(q => Math.min(item.quantity, q + 1))}
                disabled={cancelQty >= (item?.quantity || 1)}
                className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center text-text hover:bg-border transition-colors disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs text-muted">of {item?.quantity}</span>
            </div>
          </div>
        )}

        {/* Reason code dropdown */}
        <div>
          <label className="block text-xs font-semibold text-text2 mb-1.5">Reason for cancellation *</label>
          <div className="space-y-1.5">
            {REASON_CODES.map(rc => (
              <button
                key={rc.value}
                onClick={() => setReasonCode(rc.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                  reasonCode === rc.value
                    ? 'border-red bg-red-dim border-red/30 text-red font-semibold'
                    : 'border-border bg-bg text-text2 hover:border-red/30 hover:bg-red-dim/30'
                }`}
              >
                <span className="font-medium">{rc.label}</span>
                <span className="block text-[10px] text-muted mt-0.5">{rc.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Optional note */}
        <div>
          <label className="block text-xs font-semibold text-text2 mb-1">Note (optional)</label>
          <textarea
            rows={2}
            value={reasonNote}
            onChange={e => setReasonNote(e.target.value)}
            placeholder="Add any additional details..."
            className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm text-text outline-none transition-all placeholder:text-muted focus:border-red resize-none"
          />
        </div>

        {/* Manager PIN (only if approval required) */}
        {requiresApproval && (
          <div>
            <label className="block text-xs font-semibold text-text2 mb-1">Manager PIN *</label>
            <input
              type="password"
              value={managerPin}
              onChange={e => setManagerPin(e.target.value)}
              placeholder="Enter manager PIN to approve cancellation"
              className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm text-text outline-none transition-all placeholder:text-muted focus:border-red"
              autoComplete="new-password"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            className="flex-1 justify-center"
            onClick={handleClose}
          >
            Back
          </Button>
          <Button
            variant="danger"
            className="flex-1 justify-center"
            disabled={!isValid}
            loading={isPending}
            onClick={handleConfirm}
          >
            {requiresApproval ? 'Approve & Cancel' : 'Cancel Item'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
