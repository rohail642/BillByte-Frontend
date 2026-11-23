import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Download, AlertTriangle, Check, Undo2 } from 'lucide-react'
import { clsx } from 'clsx'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import EmptyState from '../ui/EmptyState'
import { formatINR } from '../../utils'
import { getPayroll, saveStaffSettings, undoSalaryPaid } from '../../api/staff'
import { MONTHS, fmtDays, roleLabel, downloadCsv } from './staffUtils'
import PayModal from './PayModal'

export default function SalarySheet({ onOpen }) {
  const qc = useQueryClient()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [paying, setPaying] = useState(null)
  const [leaveInput, setLeaveInput] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', ym.y, ym.m],
    queryFn: () => getPayroll(ym.m, ym.y),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['payroll'] })
    qc.invalidateQueries({ queryKey: ['attendance'] })
  }

  const saveLeave = useMutation({
    mutationFn: n => saveStaffSettings({ paid_leaves_per_month: n }),
    onSuccess: () => { toast.success('Saved'); setLeaveInput(null); refresh() },
    onError: e => toast.error(String(e)),
  })
  const undo = useMutation({
    mutationFn: r => undoSalaryPaid(r.staff_id, ym.y, ym.m),
    onSuccess: () => { toast('Payment undone'); refresh() },
    onError: e => toast.error(String(e)),
  })

  const shift = n => setYm(({ y, m }) => {
    const d = new Date(y, m - 1 + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  })
  const isFutureNext = ym.y > now.getFullYear() || (ym.y === now.getFullYear() && ym.m >= now.getMonth() + 1)

  const exportCsv = () => {
    const rows = data.rows.map(r => {
      const p = r.payout
      return [r.name, roleLabel(r.role), r.is_active ? '' : 'Left',
        p?.base_salary ?? r.base_salary, p?.worked_days ?? r.worked_days, r.leave_days, r.paid_leave_used,
        p?.unpaid_days ?? r.unpaid_days, p?.deduction ?? r.deduction, p?.advances ?? r.advances,
        p?.net_payable ?? r.net_payable, p ? p.paid_amount : '', p ? p.method.toUpperCase() : '', p ? p.paid_on : '',
        r.counts.unmarked || '']
    })
    downloadCsv(`salary-${MONTHS[ym.m - 1]}-${ym.y}.csv`, [
      ['Name', 'Role', 'Status', 'Monthly salary', 'Days worked', 'Leave days', 'Paid leave used', 'Unpaid days',
        'Deduction', 'Advances', 'Net payable', 'Paid amount', 'Paid via', 'Paid on', 'Days not marked'],
      ...rows,
      [],
      ['Total', '', '', data.totals.base_salary, '', '', '', '', data.totals.deduction, data.totals.advances,
        data.totals.net_payable, data.totals.paid],
    ])
  }

  if (isLoading || !data) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  const unpaidCount = data.rows.filter(r => !r.payout).length
  const leaveVal = leaveInput ?? String(data.paid_leaves_per_month)

  return (
    <div className="space-y-4">
      {/* Month picker + settings */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          <button className="p-1.5 rounded-lg hover:bg-surface2 text-text3" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-text w-32 text-center">{MONTHS[ym.m - 1]} {ym.y}</span>
          <button className="p-1.5 rounded-lg hover:bg-surface2 text-text3 disabled:opacity-30" aria-label="Next month"
            disabled={isFutureNext} onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
        {data.is_current_month && <span className="text-xs text-muted">Month in progress — figures so far</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-text2 bg-surface border border-border rounded-xl px-3 py-1.5">
            Paid leave allowed
            <input type="number" min="0" max="31" value={leaveVal} onChange={e => setLeaveInput(e.target.value)}
              className="w-12 bg-bg border border-border2 rounded-md px-1.5 py-0.5 text-sm text-text outline-none focus:border-green" />
            days / month
            {leaveInput !== null && Number(leaveInput) !== data.paid_leaves_per_month && (
              <button className="text-green2 font-bold" disabled={saveLeave.isPending}
                onClick={() => {
                  const n = Math.max(0, Math.min(31, parseInt(leaveInput, 10) || 0))
                  saveLeave.mutate(n)
                }}>Save</button>
            )}
          </label>
          <Button variant="secondary" size="sm" icon={<Download size={13} />} disabled={!data.rows.length} onClick={exportCsv}>CSV</Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Total salaries', data.totals.base_salary, 'text-text'],
          ['Deductions + advances', data.totals.deduction + data.totals.advances, 'text-orange'],
          ['Net payable', data.totals.net_payable, 'text-green2'],
          ['Paid so far', data.totals.paid, 'text-blue'],
        ].map(([label, val, cls]) => (
          <Card key={label}>
            <p className="text-[10px] text-muted uppercase font-bold tracking-wide">{label}</p>
            <p className={clsx('font-display font-black text-lg mt-1', cls)}>{formatINR(val)}</p>
          </Card>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <EmptyState icon="💰" title="No staff for this month" description="Add your team in the Team tab." />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted border-b border-border">
                <th className="text-left font-bold px-4 py-2.5">Staff</th>
                <th className="text-right font-bold px-3 py-2.5">Salary</th>
                <th className="text-right font-bold px-3 py-2.5">Worked</th>
                <th className="text-right font-bold px-3 py-2.5">Unpaid days</th>
                <th className="text-right font-bold px-3 py-2.5">Deduction</th>
                <th className="text-right font-bold px-3 py-2.5">Advances</th>
                <th className="text-right font-bold px-3 py-2.5">Net payable</th>
                <th className="text-right font-bold px-4 py-2.5">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map(r => {
                const p = r.payout
                const v = p || r
                return (
                  <tr key={r.staff_id} className="align-top">
                    <td className="px-4 py-3">
                      <button className="text-left" onClick={() => onOpen(r.staff_id, r)}>
                        <p className="font-semibold text-text hover:text-green2">{r.name}{!r.is_active && <span className="ml-1.5 text-[10px] font-bold text-muted uppercase">Left</span>}</p>
                        <p className="text-[11px] text-muted">{roleLabel(r.role)}</p>
                      </button>
                      {!p && r.counts.unmarked > 0 && (
                        <p className="mt-1 text-[11px] text-amber flex items-center gap-1">
                          <AlertTriangle size={11} /> {r.counts.unmarked} day{r.counts.unmarked > 1 ? 's' : ''} not marked
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatINR(v.base_salary)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtDays(v.worked_days)}<span className="text-muted">/{r.days_in_month}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtDays(v.unpaid_days)}
                      {!p && r.paid_leave_used > 0 && <p className="text-[10px] text-muted">{fmtDays(r.paid_leave_used)} paid leave</p>}
                      {!p && r.counts.before_joining > 0 && <p className="text-[10px] text-muted">{r.counts.before_joining} before joining</p>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-orange">{v.deduction ? `−${formatINR(v.deduction)}` : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-orange">{v.advances ? `−${formatINR(v.advances)}` : '—'}</td>
                    <td className={clsx('px-3 py-3 text-right tabular-nums font-bold', v.net_payable < 0 ? 'text-red' : 'text-text')}>
                      {formatINR(v.net_payable)}
                      {v.net_payable < 0 && <p className="text-[10px] font-normal">advance exceeds salary</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green2"><Check size={12} /> Paid {formatINR(p.paid_amount)}</span>
                          <span className="text-[10px] text-muted">{p.method.toUpperCase()} · {new Date(p.paid_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          <button className="text-[10px] text-muted hover:text-red flex items-center gap-0.5" disabled={undo.isPending}
                            onClick={() => undo.mutate(r)}><Undo2 size={10} /> Undo</button>
                        </div>
                      ) : (
                        <Button variant="primary" size="xs" onClick={() => setPaying(r)}>Mark paid</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-[11px] text-muted">
        Salary ÷ days in the month × unpaid days is deducted. Unpaid days = leave beyond the {data.paid_leaves_per_month}-day
        allowance (half day = ½), plus days before joining. Weekly offs and “Off” days are paid. Days not marked aren't deducted —
        mark them before paying. {unpaidCount > 0 && `${unpaidCount} of ${data.rows.length} not paid yet.`}
      </p>

      {paying && (
        <PayModal row={paying} year={ym.y} month={ym.m} onClose={() => setPaying(null)}
          onDone={() => { setPaying(null); refresh() }} />
      )}
    </div>
  )
}
