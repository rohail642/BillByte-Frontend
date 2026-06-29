import { useState, useEffect, useRef } from 'react'
import { initiatePayment, pollPaymentStatus, cancelPayment } from '../../api/payments'
import { formatINR } from '../../utils'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import toast from 'react-hot-toast'

const POLL_INTERVAL_MS = 2500
const TIMEOUT_SECONDS  = 90

const STATUS_UI = {
  pending: {
    icon: '📡',
    title: 'Waiting for payment…',
    subtitle: 'Ask customer to tap, insert, or swipe on the terminal',
    color: 'text-blue',
  },
  success: {
    icon: '✅',
    title: 'Payment Successful!',
    subtitle: 'Transaction approved',
    color: 'text-green2',
  },
  failed: {
    icon: '❌',
    title: 'Payment Failed',
    subtitle: 'Card declined or transaction rejected',
    color: 'text-red',
  },
  cancelled: {
    icon: '🚫',
    title: 'Payment Cancelled',
    subtitle: 'Transaction was cancelled',
    color: 'text-muted',
  },
  timeout: {
    icon: '⏱️',
    title: 'Payment Timed Out',
    subtitle: 'No response from terminal. Please try again.',
    color: 'text-amber',
  },
}

export default function PaymentModal({ open, mode, amount, orderId, onSuccess, onClose }) {
  const [phase, setPhase]         = useState('idle')   // idle | initiating | pending | success | failed | cancelled | timeout
  const [txnNumber, setTxnNumber] = useState(null)
  const [txnData, setTxnData]     = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS)
  const [cancelling, setCancelling]   = useState(false)

  const pollRef    = useRef(null)
  const timerRef   = useRef(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearInterval(pollRef.current)
      clearInterval(timerRef.current)
    }
  }, [])

  // Auto-start when modal opens
  useEffect(() => {
    if (open && phase === 'idle') {
      start()
    }
    if (!open) {
      reset()
    }
  }, [open])

  function reset() {
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
    setPhase('idle')
    setTxnNumber(null)
    setTxnData(null)
    setSecondsLeft(TIMEOUT_SECONDS)
    setCancelling(false)
  }

  async function start() {
    setPhase('initiating')
    try {
      const res = await initiatePayment(orderId, amount, mode)
      if (!mountedRef.current) return
      setTxnNumber(res.txn_number)
      setPhase('pending')
      startPolling(res.txn_number)
      startTimer()
    } catch (err) {
      if (!mountedRef.current) return
      toast.error(String(err))
      setPhase('failed')
    }
  }

  function startPolling(txn) {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) return
      try {
        const data = await pollPaymentStatus(txn)
        if (!mountedRef.current) return
        if (data.status !== 'pending') {
          clearInterval(pollRef.current)
          clearInterval(timerRef.current)
          setTxnData(data)
          setPhase(data.status)
          if (data.status === 'success') {
            onSuccess(mode)
          }
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS)
  }

  function startTimer() {
    clearInterval(timerRef.current)
    setSecondsLeft(TIMEOUT_SECONDS)
    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          clearInterval(pollRef.current)
          setPhase('timeout')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleCancel() {
    setCancelling(true)
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
    try {
      if (txnNumber) await cancelPayment(txnNumber)
    } catch { /* best effort */ }
    if (mountedRef.current) {
      setPhase('cancelled')
      setCancelling(false)
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleRetry() {
    reset()
    await new Promise(r => setTimeout(r, 100))
    start()
  }

  const modeLabel = mode === 'card' ? '💳 Card' : '📱 UPI'
  const ui = STATUS_UI[phase] || STATUS_UI.pending

  const isTerminal = phase === 'pending'
  const isDone     = ['success', 'failed', 'cancelled', 'timeout'].includes(phase)

  return (
    <Modal open={open} onClose={isDone ? handleClose : undefined} title={`${modeLabel} Payment`}>
      <div className="text-center py-4">
        {/* Amount */}
        <p className="font-display font-black text-4xl text-green2 mb-1">{formatINR(amount)}</p>
        <p className="text-xs text-muted mb-6">via Pine Labs terminal</p>

        {/* Status icon */}
        <div className="text-5xl mb-3">
          {phase === 'initiating'
            ? <span className="inline-block animate-spin">⚙️</span>
            : <span>{ui.icon}</span>}
        </div>

        {/* Status text */}
        <p className={`font-display font-bold text-lg mb-1 ${phase === 'initiating' ? 'text-text' : ui.color}`}>
          {phase === 'initiating' ? 'Connecting to terminal…' : ui.title}
        </p>
        <p className="text-xs text-muted mb-6">
          {phase === 'initiating' ? 'Sending payment request to Pine Labs' : ui.subtitle}
        </p>

        {/* Terminal animation while pending */}
        {isTerminal && (
          <div className="flex justify-center gap-1.5 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-blue rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* Countdown */}
        {isTerminal && (
          <p className="text-xs text-muted mb-6">
            Auto-cancels in <span className="font-bold text-text">{secondsLeft}s</span>
          </p>
        )}

        {/* Approval code on success */}
        {phase === 'success' && txnData?.approval_code && (
          <div className="bg-green-dim rounded-xl px-4 py-3 mb-4 inline-block">
            <p className="text-[10px] text-muted font-bold uppercase tracking-wide">Approval Code</p>
            <p className="font-display font-black text-xl text-green2">{txnData.approval_code}</p>
            {txnData.card_type && <p className="text-xs text-muted">{txnData.card_type} · {txnData.card_number}</p>}
          </div>
        )}

        {/* Error message */}
        {['failed', 'cancelled', 'timeout'].includes(phase) && txnData?.response_message && (
          <p className="text-xs text-red bg-red-dim rounded-lg px-3 py-2 mb-4">{txnData.response_message}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 justify-center mt-2">
          {isTerminal && (
            <Button variant="secondary" size="sm" loading={cancelling} onClick={handleCancel}>
              Cancel Payment
            </Button>
          )}
          {phase === 'success' && (
            <Button size="sm" onClick={handleClose}>Done</Button>
          )}
          {['failed', 'timeout'].includes(phase) && (
            <>
              <Button variant="secondary" size="sm" onClick={handleClose}>Close</Button>
              <Button size="sm" onClick={handleRetry}>Try Again</Button>
            </>
          )}
          {phase === 'cancelled' && (
            <Button variant="secondary" size="sm" onClick={handleClose}>Close</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
