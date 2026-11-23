import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, CheckCheck, Download } from 'lucide-react'
import { clsx } from 'clsx'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import EmptyState from '../ui/EmptyState'
import { getDayAttendance, markBulk, getMonthAttendance } from '../../api/staff'
import { STATUS, MARKABLE, addDays, prettyDate, parseYmd, roleLabel, downloadCsv, MONTHS } from './staffUtils'

// One screen to mark everyone for a day. Click a status to set it; click it again to clear.
export default function AttendanceSheet({ onOpen }) {
  const qc = useQueryClient()
  const [day, setDay] = useState(null) // null = today (server's India date)

  const { data, isLoading } = useQuery({
    queryKey: ['staffDay', day],
    queryFn: () => getDayAttendance(day),
  })
  const today = data?.today
  const current = data?.date
  const minDay = today ? addDays(today, -(data.backfill_days || 60)) : null

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['staffDay'] })
    qc.invalidateQueries({ queryKey: ['staff'] })
    qc.invalidateQueries({ queryKey: ['attendance'] })
    qc.invalidateQueries({ queryKey: ['payroll'] })
  }
  const save = useMutation({
    mutationFn: entries => markBulk(current, entries),
    onSuccess: refresh,
    onError: e => toast.error(String(e)),
  })

  const rows = data?.staff || []
  const markable = rows.filter(r => !r.not_joined)
  const remaining = markable.filter(r => r.status === 'unmarked')
  const counts = Object.fromEntries(Object.keys(STATUS).map(k => [k, markable.filter(r => r.status === k).length]))

  const setStatus = (r, s) => save.mutate([{ staff_id: r.staff_id, status: r.status === s ? null : s }])
  const markRemaining = () => {
    save.mutate(remaining.map(r => ({ staff_id: r.staff_id, status: 'present' })), {
      onSuccess: () => toast.success(`${remaining.length} marked present`),
    })
  }

  const exportMonth = async () => {
    const d = parseYmd(current)
    const m = d.getMonth() + 1, y = d.getFullYear()
    try {
      const res = await getMonthAttendance(m, y)
      const dayKeys = Array.from({ length: res.days_in_month }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
      const header = ['Name', 'Role', ...dayKeys.map((_, i) => String(i + 1)), 'Present', 'Half days', 'Leave', 'Off', 'Not marked']
      const lines = res.staff.map(s => {
        const vals = dayKeys.map(k => s.days[k])
        const n = st => vals.filter(v => v === st).length
        return [s.name, roleLabel(s.role), ...vals.map(v => (v ? STATUS[v]?.short || '' : '')),
          n('present'), n('half_day'), n('leave'), n('off') + n('weekly_off'), n('unmarked')]
      })
      downloadCsv(`attendance-${MONTHS[m - 1]}-${y}.csv`, [header, ...lines,
        [], ['P = Present, ½ = Half day, L = Leave, O = Off, W = Weekly off, blank = not marked / not joined / upcoming']])
    } catch (e) { toast.error(String(e)) }
  }

  if (isLoading || !data) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4">
      {/* Day picker + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          <button className="p-1.5 rounded-lg hover:bg-surface2 text-text3 disabled:opacity-30" aria-label="Previous day"
            disabled={current <= minDay} onClick={() => setDay(addDays(current, -1))}><ChevronLeft size={16} /></button>
          <input type="date" value={current} min={minDay} max={today}
            onChange={e => e.target.value && setDay(e.target.value > today ? today : e.target.value)}
            className="bg-transparent text-sm font-semibold text-text outline-none px-1 cursor-pointer" />
          <button className="p-1.5 rounded-lg hover:bg-surface2 text-text3 disabled:opacity-30" aria-label="Next day"
            disabled={current >= today} onClick={() => setDay(addDays(current, 1))}><ChevronRight size={16} /></button>
        </div>
        <p className="text-sm font-semibold text-text">{current === today ? 'Today' : prettyDate(current, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        {current !== today && <button className="text-xs text-green2 font-semibold hover:underline" onClick={() => setDay(null)}>Back to today</button>}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportMonth}>Month CSV</Button>
          <Button variant="primary" size="sm" icon={<CheckCheck size={14} />} disabled={!remaining.length}
            loading={save.isPending && save.variables?.length > 1} onClick={markRemaining}>
            Mark {remaining.length ? `${remaining.length} remaining` : 'remaining'} present
          </Button>
        </div>
      </div>

      {/* Day summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        {['present', 'half_day', 'leave', 'off', 'weekly_off', 'unmarked'].map(k => counts[k] > 0 && (
          <span key={k} className={clsx('px-2.5 py-1 rounded-full border font-semibold', STATUS[k].cell)}>
            {STATUS[k].label} · {counts[k]}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="👥" title="No staff yet" description="Add your team in the Team tab first." />
      ) : (
        <Card className="p-0 divide-y divide-border overflow-hidden">
          {rows.map(r => (
            <div key={r.staff_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(r.staff_id)}>
                <p className="text-sm font-semibold text-text truncate hover:text-green2">{r.name}</p>
                <p className="text-[11px] text-muted">
                  {roleLabel(r.role)}
                  {r.status === 'weekly_off' && ' · weekly off'}
                  {r.notes && ` · ${r.notes}`}
                </p>
              </button>
              {r.not_joined ? (
                <span className="text-xs text-muted">Not joined yet</span>
              ) : (
                <div className="flex gap-1">
                  {MARKABLE.map(s => (
                    <button key={s} title={STATUS[s].label}
                      disabled={save.isPending}
                      onClick={() => setStatus(r, s)}
                      className={clsx('min-w-[44px] sm:min-w-[72px] px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                        r.status === s ? STATUS[s].btn : 'bg-surface2 text-text3 border-border hover:border-green hover:text-green2')}>
                      <span className="sm:hidden">{STATUS[s].short}</span>
                      <span className="hidden sm:inline">{STATUS[s].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      <p className="text-[11px] text-muted">
        Click a status again to clear it. <b>Off</b> is a paid day off (holiday); <b>Leave</b> counts against the paid-leave allowance in the Salary tab.
        You can correct the last {data.backfill_days} days.
      </p>
    </div>
  )
}
