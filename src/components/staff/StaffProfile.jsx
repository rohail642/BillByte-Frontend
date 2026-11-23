import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Pencil, Trash2, Plus, X, CalendarDays, StickyNote } from 'lucide-react'
import { clsx } from 'clsx'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Spinner from '../ui/Spinner'
import { formatINR, initials, avatarColor } from '../../utils'
import {
  getAttendance, markAttendance, clearAttendance, getAdvances, addAdvance, deleteAdvance,
  updateStaff, deleteStaff, undoSalaryPaid,
} from '../../api/staff'
import { STATUS, MARKABLE, MONTHS, WEEKDAYS, ymd, addDays, prettyDate, fmtDays, roleLabel, localDay } from './staffUtils'
import StaffFormModal from './StaffFormModal'
import PayModal from './PayModal'

export default function StaffProfile({ member, onBack }) {
  const qc = useQueryClient()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [dayEdit, setDayEdit] = useState(null)    // { date, status, notes }
  const [advOpen, setAdvOpen] = useState(false)
  const [paying, setPaying] = useState(false)

  const { data: att, isLoading } = useQuery({
    queryKey: ['attendance', member.id, ym.m, ym.y],
    queryFn: () => getAttendance(member.id, ym.m, ym.y),
  })
  const { data: advances = [] } = useQuery({
    queryKey: ['advances', member.id, ym.m, ym.y],
    queryFn: () => getAdvances(member.id, ym.m, ym.y),
  })

  const refresh = () => {
    for (const k of ['attendance', 'advances', 'staff', 'staffDay', 'payroll']) qc.invalidateQueries({ queryKey: [k] })
  }
  const mark = useMutation({
    mutationFn: ({ date, status, notes }) => status
      ? markAttendance(member.id, { status, notes: notes || null, date })
      : clearAttendance(member.id, date),
    onSuccess: () => { setDayEdit(null); refresh() },
    onError: e => toast.error(String(e)),
  })
  const save = useMutation({
    mutationFn: body => updateStaff(member.id, body),
    onSuccess: () => { toast.success('Saved'); setEditing(false); refresh() },
    onError: e => toast.error(String(e)),
  })
  const remove = useMutation({
    mutationFn: () => deleteStaff(member.id),
    onSuccess: () => { toast.success(`${member.name} removed`); refresh(); onBack() },
    onError: e => toast.error(String(e)),
  })
  const delAdv = useMutation({
    mutationFn: deleteAdvance,
    onSuccess: () => { toast('Advance removed'); refresh() },
    onError: e => toast.error(String(e)),
  })
  const undo = useMutation({
    mutationFn: () => undoSalaryPaid(member.id, ym.y, ym.m),
    onSuccess: () => { toast('Payment undone'); refresh() },
    onError: e => toast.error(String(e)),
  })

  const today = att?.today || ymd(now)
  const minDay = addDays(today, -(att?.backfill_days || 60))
  const removed = member.is_active === false
  const todayStatus = member.status
  const cfg = STATUS[todayStatus] || STATUS.unmarked
  const shift = n => setYm(({ y, m }) => { const d = new Date(y, m - 1 + n, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 } })
  const atCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1

  return (
    <div className="space-y-4 animate-fadeUp">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-text3 hover:text-text transition-colors">
        <ArrowLeft size={15} /> Back to staff
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ── Profile ── */}
        <Card className="space-y-4">
          <div className="text-center py-1">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
              style={{ background: avatarColor(member.id) }}>{initials(member.name)}</div>
            <h2 className="font-display font-bold text-lg text-text">{member.name}</h2>
            <p className="text-sm text-muted">{roleLabel(member.role)}</p>
            {member.phone && <p className="text-xs text-muted flex items-center justify-center gap-1 mt-1"><Phone size={11} />{member.phone}</p>}
            <div className="mt-2">{removed ? <Badge color="red">Removed</Badge> : <Badge color={cfg.badge}>Today: {cfg.label}</Badge>}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-surface2 rounded-xl p-2.5">
              <p className="text-[10px] text-muted uppercase font-bold tracking-wide">Monthly salary</p>
              <p className="font-display font-black text-base text-green2">{formatINR(member.salary)}</p>
            </div>
            <div className="bg-surface2 rounded-xl p-2.5">
              <p className="text-[10px] text-muted uppercase font-bold tracking-wide">Weekly off</p>
              <p className="font-display font-bold text-sm text-text mt-0.5">{member.weekly_off != null ? WEEKDAYS[member.weekly_off] : 'None'}</p>
            </div>
          </div>
          <div className="text-xs text-text3 space-y-1">
            {member.join_date && <p className="flex items-center gap-1.5"><CalendarDays size={12} /> Joined {prettyDate(localDay(member.join_date), { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
            {member.notes && <p className="flex items-start gap-1.5"><StickyNote size={12} className="mt-0.5 shrink-0" /> {member.notes}</p>}
          </div>

          {!removed && <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">Today's attendance</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MARKABLE.map(s => (
                <button key={s} disabled={mark.isPending}
                  onClick={() => s === 'leave'
                    ? setDayEdit({ date: today, status: 'leave', notes: '' })
                    : mark.mutate({ date: today, status: todayStatus === s ? null : s })}
                  className={clsx('py-2 rounded-lg text-[11px] font-bold border transition-colors',
                    todayStatus === s ? STATUS[s].btn : 'bg-surface2 text-text3 border-border hover:border-green hover:text-green2')}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
          </div>}

          {!removed && <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1 justify-center" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger" size="sm" className="flex-1 justify-center" icon={<Trash2 size={13} />} onClick={() => setConfirmRemove(true)}>Remove</Button>
          </div>}
        </Card>

        {/* ── Month: calendar + salary + advances ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} aria-label="Previous month" className="p-2 rounded-lg hover:bg-surface2 text-text3"><ChevronLeft size={16} /></button>
            <h3 className="font-display font-bold text-sm text-text w-36 text-center">{MONTHS[ym.m - 1]} {ym.y}</h3>
            <button onClick={() => shift(1)} aria-label="Next month" disabled={atCurrentMonth} className="p-2 rounded-lg hover:bg-surface2 text-text3 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>

          {isLoading || !att ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <Card>
                <Calendar att={att} ym={ym} today={today} minDay={removed ? '9999' : minDay}
                  onPick={(date, log) => setDayEdit({ date, status: log?.status || null, notes: log?.notes || '' })} />
              </Card>

              <div className="space-y-4">
                <SalaryCard att={att} onPay={() => setPaying(true)} onUndo={() => undo.mutate()} undoing={undo.isPending} />

                <Card className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm text-text">Advances this month</h3>
                    <Button variant="secondary" size="xs" icon={<Plus size={12} />} disabled={!!att.payout || removed} onClick={() => setAdvOpen(true)}>Add</Button>
                  </div>
                  {advances.length === 0 ? <p className="text-xs text-muted">No advances. Money given during the month is deducted from the salary.</p> : (
                    <div className="divide-y divide-border">
                      {advances.map(a => (
                        <div key={a.id} className="flex items-center gap-2 py-1.5 text-sm">
                          <span className="text-xs text-muted w-16">{prettyDate(a.date, { day: 'numeric', month: 'short' })}</span>
                          <span className="flex-1 text-text2 truncate">{a.note || 'Advance'}</span>
                          <span className="font-semibold tabular-nums">{formatINR(a.amount)}</span>
                          {!att.payout && (
                            <button aria-label="Remove advance" className="p-1 text-muted hover:text-red" disabled={delAdv.isPending}
                              onClick={() => delAdv.mutate(a.id)}><X size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {att.payout && <p className="text-[11px] text-muted">Salary already paid for this month — undo the payment to change advances.</p>}
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mark / correct one day */}
      <Modal open={!!dayEdit} onClose={() => setDayEdit(null)} size="sm"
        title={dayEdit ? `${member.name} — ${prettyDate(dayEdit.date, { weekday: 'long', day: 'numeric', month: 'short' })}` : ''}
        footer={<>
          <Button variant="ghost" disabled={mark.isPending} onClick={() => mark.mutate({ date: dayEdit.date, status: null })}>Clear</Button>
          <Button variant="primary" loading={mark.isPending} disabled={!dayEdit?.status}
            onClick={() => mark.mutate(dayEdit)}>Save</Button>
        </>}>
        {dayEdit && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              {MARKABLE.map(s => (
                <button key={s} onClick={() => setDayEdit(d => ({ ...d, status: s }))}
                  className={clsx('py-2 rounded-lg text-[11px] font-bold border',
                    dayEdit.status === s ? STATUS[s].btn : 'bg-surface2 text-text3 border-border hover:border-green')}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
            <Input label="Reason / note (optional)" value={dayEdit.notes} maxLength={300}
              placeholder="e.g. Sick, family function" onChange={e => setDayEdit(d => ({ ...d, notes: e.target.value }))} />
          </div>
        )}
      </Modal>

      {advOpen && <AdvanceModal member={member} today={today} ym={ym} onClose={() => setAdvOpen(false)} onDone={() => { setAdvOpen(false); refresh() }} />}

      {editing && <StaffFormModal open member={member} saving={save.isPending} onClose={() => setEditing(false)} onSave={b => save.mutate(b)} />}

      {paying && att && (
        <PayModal row={{ ...att.salary, staff_id: member.id, name: member.name }} year={ym.y} month={ym.m}
          onClose={() => setPaying(false)} onDone={() => { setPaying(false); refresh() }} />
      )}

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title={`Remove ${member.name}?`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmRemove(false)}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Remove</Button>
        </>}>
        <p className="text-sm text-text2">They'll disappear from the team and attendance sheet. Their attendance and salary history is kept, and they still appear in the Salary tab for months they worked, so you can settle the final salary.</p>
      </Modal>
    </div>
  )
}

function Calendar({ att, ym, today, minDay, onPick }) {
  const days = new Date(ym.y, ym.m, 0).getDate()
  const firstDow = new Date(ym.y, ym.m - 1, 1).getDay() // 0 = Sun
  const logs = Object.fromEntries(att.logs.map(l => [l.date, l]))
  const join = att.join_date
  const s = att.summary
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {[['present', s.present], ['half_day', s.half_day], ['leave', s.leave], ['off', s.off], ['unmarked', s.unmarked]].map(([k, n]) => (
          <span key={k} className={clsx('px-2 py-0.5 rounded-full border font-semibold', STATUS[k].cell)}>{STATUS[k].label} {n}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
          const log = logs[date]
          const future = date > today
          const beforeJoin = join && date < join
          const editable = !future && !beforeJoin && date >= minDay
          const weeklyOff = !log && att.weekly_off != null && (new Date(ym.y, ym.m - 1, i + 1).getDay() + 6) % 7 === att.weekly_off
          const st = log ? log.status : weeklyOff ? 'weekly_off' : 'unmarked'
          return (
            <button key={date} disabled={!editable} onClick={() => onPick(date, log)}
              title={future ? '' : beforeJoin ? 'Before joining' : `${STATUS[st].label}${log?.notes ? ' — ' + log.notes : ''}${editable ? '' : ' (too old to change)'}`}
              className={clsx('aspect-square rounded-lg border flex flex-col items-center justify-center text-[11px] font-bold transition-colors',
                future || beforeJoin ? 'bg-surface2/50 text-border2 border-transparent' : STATUS[st].cell,
                editable && 'hover:ring-2 hover:ring-green/40 cursor-pointer',
                date === today && 'ring-2 ring-green')}>
              {i + 1}
              {!future && !beforeJoin && STATUS[st].short && <span className="text-[8px] opacity-70">{STATUS[st].short}</span>}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-muted">Tap a day to mark or correct it (last {att.backfill_days} days).</p>
    </div>
  )
}

function SalaryCard({ att, onPay, onUndo, undoing }) {
  const c = att.salary
  const p = att.payout
  const v = p || c
  const rows = [
    ['Monthly salary', formatINR(v.base_salary)],
    ['Days worked', `${fmtDays(v.worked_days)} of ${c.days_in_month}`],
    [`Unpaid days (${fmtDays(v.unpaid_days)})`, v.deduction ? `−${formatINR(v.deduction)}` : '—'],
    ['Advances', v.advances ? `−${formatINR(v.advances)}` : '—'],
  ]
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm text-text">Salary</h3>
        {p ? <Badge color="green">Paid</Badge> : <Badge color="amber">Not paid</Badge>}
      </div>
      <div className="text-sm space-y-1">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between"><span className="text-text3">{k}</span><span className="tabular-nums">{val}</span></div>
        ))}
        <div className="flex justify-between font-bold border-t border-border pt-1.5">
          <span>Net payable</span><span className={clsx('tabular-nums', v.net_payable < 0 && 'text-red')}>{formatINR(v.net_payable)}</span>
        </div>
      </div>
      {!p && c.paid_leave_used > 0 && <p className="text-[11px] text-muted">{fmtDays(c.paid_leave_used)} leave day{c.paid_leave_used > 1 ? 's' : ''} covered by paid leave.</p>}
      {!p && c.counts.unmarked > 0 && <p className="text-[11px] text-amber">{c.counts.unmarked} day{c.counts.unmarked > 1 ? 's' : ''} not marked yet (not deducted).</p>}
      {p ? (
        <div className="flex items-center justify-between text-xs text-text3 bg-green-dim rounded-lg px-3 py-2">
          <span>Paid {formatINR(p.paid_amount)} by {p.method.toUpperCase()} on {prettyDate(p.paid_on, { day: 'numeric', month: 'short' })}{p.note ? ` · ${p.note}` : ''}</span>
          <button className="font-semibold hover:text-red" disabled={undoing} onClick={onUndo}>Undo</button>
        </div>
      ) : (
        <Button variant="primary" size="sm" className="w-full justify-center" onClick={onPay}>Mark salary paid</Button>
      )}
    </Card>
  )
}

function AdvanceModal({ member, today, ym, onClose, onDone }) {
  // Default the date into the month being viewed (today if it's the current month).
  const last = `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(new Date(ym.y, ym.m, 0).getDate()).padStart(2, '0')}`
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today < last ? today : last)
  const [note, setNote] = useState('')
  const add = useMutation({
    mutationFn: () => addAdvance(member.id, { amount: Number(amount), date, note: note.trim() || null }),
    onSuccess: () => { toast.success('Advance recorded'); onDone() },
    onError: e => toast.error(String(e)),
  })
  return (
    <Modal open onClose={onClose} title={`Advance to ${member.name}`} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={add.isPending} disabled={!(Number(amount) > 0)} onClick={() => add.mutate()}>Save</Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (₹)" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
          <Input label="Date" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} />
        </div>
        <Input label="Note (optional)" value={note} maxLength={200} placeholder="e.g. Festival advance" onChange={e => setNote(e.target.value)} />
        <p className="text-[11px] text-muted">Deducted from the salary of the month it's dated in.</p>
      </div>
    </Modal>
  )
}
