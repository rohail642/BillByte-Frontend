import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { formatINR } from '../../utils'
import { markSalaryPaid } from '../../api/staff'
import { MONTHS, ymd, fmtDays } from './staffUtils'

// Record a month's salary as paid. The calculation is frozen on the server at this moment.
export default function PayModal({ row, year, month, onClose, onDone }) {
  const [amount, setAmount] = useState(String(Math.max(row.net_payable, 0)))
  const [method, setMethod] = useState('cash')
  const [paidOn, setPaidOn] = useState(ymd(new Date()))
  const [note, setNote] = useState('')

  const pay = useMutation({
    mutationFn: () => markSalaryPaid(row.staff_id, {
      year, month, method, paid_on: paidOn, note: note.trim() || null,
      paid_amount: Number(amount) || 0,
    }),
    onSuccess: () => { toast.success(`${row.name}'s salary marked paid`); onDone() },
    onError: e => toast.error(String(e)),
  })

  const lines = [
    ['Monthly salary', formatINR(row.base_salary)],
    [`Unpaid days (${fmtDays(row.unpaid_days)})`, row.deduction ? `−${formatINR(row.deduction)}` : '—'],
    ['Advances', row.advances ? `−${formatINR(row.advances)}` : '—'],
  ]

  return (
    <Modal open onClose={onClose} title={`Pay ${row.name} — ${MONTHS[month - 1]} ${year}`} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={pay.isPending} onClick={() => pay.mutate()}>Mark paid</Button>
      </>}>
      <div className="space-y-3">
        <div className="bg-surface2 rounded-xl p-3 text-sm space-y-1">
          {lines.map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="text-text3">{k}</span><span className="tabular-nums">{v}</span></div>
          ))}
          <div className="flex justify-between font-bold border-t border-border pt-1.5 mt-1.5">
            <span>Net payable</span><span className="tabular-nums">{formatINR(row.net_payable)}</span>
          </div>
        </div>
        {row.counts?.unmarked > 0 && (
          <p className="text-xs bg-amber-dim text-amber rounded-lg px-3 py-2">
            {row.counts.unmarked} working day{row.counts.unmarked > 1 ? 's are' : ' is'} not marked. They're treated as worked — mark them first if that's wrong.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount paid (₹)" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
          <Select label="Paid via" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank transfer</option>
          </Select>
        </div>
        <Input label="Paid on" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
        <Input label="Note (optional)" value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="e.g. Includes ₹500 bonus" />
      </div>
    </Modal>
  )
}
