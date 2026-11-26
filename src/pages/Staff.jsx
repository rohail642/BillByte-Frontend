import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Users, CalendarCheck, Wallet } from 'lucide-react'
import { clsx } from 'clsx'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { formatINR, initials, avatarColor } from '../utils'
import { getStaff, createStaff } from '../api/staff'
import { STATUS, WEEKDAYS, roleLabel } from '../components/staff/staffUtils'
import StaffFormModal from '../components/staff/StaffFormModal'
import AttendanceSheet from '../components/staff/AttendanceSheet'
import SalarySheet from '../components/staff/SalarySheet'
import StaffProfile from '../components/staff/StaffProfile'

const TABS = [
  ['team', 'Team', Users],
  ['attendance', 'Attendance', CalendarCheck],
  ['salary', 'Salary', Wallet],
]

export default function Staff() {
  const qc = useQueryClient()
  // Tab and open profile live in the URL (/staff?tab=salary&id=3), so the
  // sidebar's "Staff" link (plain /staff) always returns to the main page and
  // the back button steps between tabs / out of a profile.
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'team'
  const openId = params.get('id') ? Number(params.get('id')) : null
  const setTab = id => setParams(id === 'team' ? {} : { tab: id })
  const [fallback, setFallback] = useState(null) // removed staff opened from the Salary tab
  const [adding, setAdding] = useState(false)

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: getStaff })

  const create = useMutation({
    mutationFn: createStaff,
    onSuccess: m => {
      toast.success(`${m.name} added`)
      setAdding(false)
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['staffDay'] })
      qc.invalidateQueries({ queryKey: ['payroll'] })
    },
    onError: e => toast.error(String(e)),
  })

  const open = (id, fb = null) => {
    setFallback(fb)
    const next = tab === 'team' ? {} : { tab }
    setParams(id == null ? next : { ...next, id: String(id) })
  }
  const member = openId != null ? (staff.find(s => s.id === openId) || (fallback?.id === openId ? fallback : null)) : null
  if (member) return <StaffProfile key={member.id} member={member} onBack={() => open(null)} />

  const count = s => staff.filter(m => m.status === s).length
  const stats = [
    ['Team', staff.length, 'text-text'],
    ['Present today', count('present') + count('half_day'), 'text-green2'],
    ['On leave / off', count('leave') + count('off') + count('weekly_off'), 'text-orange'],
    ['Not marked yet', count('unmarked'), count('unmarked') ? 'text-amber' : 'text-muted'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-surface2 rounded-lg p-1 text-sm font-semibold">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors',
                tab === id ? 'bg-bg2 text-text shadow-sm' : 'text-text3 hover:text-text')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {tab === 'team' && (
          <Button variant="primary" size="sm" className="ml-auto" icon={<Plus size={14} />} onClick={() => setAdding(true)}>Add staff</Button>
        )}
      </div>

      {tab === 'attendance' && <AttendanceSheet onOpen={id => open(id)} />}
      {tab === 'salary' && (
        <SalarySheet onOpen={(id, row) => open(id, {
          id, name: row.name, role: row.role, salary: row.base_salary,
          status: 'unmarked', is_active: false, weekly_off: null,
        })} />
      )}

      {tab === 'team' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map(([label, val, cls]) => (
              <Card key={label}>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wide">{label}</p>
                <p className={clsx('font-display font-black text-2xl mt-1', cls)}>{val}</p>
              </Card>
            ))}
          </div>

          {count('unmarked') > 0 && (
            <button onClick={() => setTab('attendance')}
              className="w-full text-left text-xs bg-amber-dim text-amber rounded-lg px-3 py-2 font-semibold hover:opacity-90">
              {count('unmarked')} {count('unmarked') === 1 ? 'person hasn\'t' : 'people haven\'t'} been marked today → open the attendance sheet
            </button>
          )}

          {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            : staff.length === 0
              ? <EmptyState icon={<Users />} title="No staff yet" description="Add your team to track attendance, advances and salary." />
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {staff.map(m => {
                    const cfg = STATUS[m.status] || STATUS.unmarked
                    return (
                      <Card key={m.id} hover className="text-center cursor-pointer" onClick={() => open(m.id)}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white mx-auto mb-2"
                          style={{ background: avatarColor(m.id) }}>{initials(m.name)}</div>
                        <p className="font-display font-bold text-sm text-text">{m.name}</p>
                        <p className="text-xs text-muted mb-2">{roleLabel(m.role)}</p>
                        <Badge color={cfg.badge}>{cfg.label}</Badge>
                        <p className="text-xs text-muted mt-2">
                          {formatINR(m.salary)}/mo{m.weekly_off != null && ` · off ${WEEKDAYS[m.weekly_off].slice(0, 3)}`}
                        </p>
                      </Card>
                    )
                  })}
                </div>
              )}
        </>
      )}

      {adding && <StaffFormModal open member={null} saving={create.isPending} onClose={() => setAdding(false)} onSave={b => create.mutate(b)} />}
    </div>
  )
}
