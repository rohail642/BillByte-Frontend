import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStaff, createStaff, updateStaff, markAttendance, getAttendance, deleteStaff } from '../api/staff'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Plus, ArrowLeft, ChevronLeft, ChevronRight, Phone, IndianRupee, Pencil, Trash2 } from 'lucide-react'
import { formatINR, initials, avatarColor } from '../utils'

const STATUS_CONFIG = {
  present: { label: 'Present', color: 'green',  bg: 'bg-green-dim',  text: 'text-green2',  border: 'border-green/20'  },
  leave:   { label: 'Leave',   color: 'orange', bg: 'bg-orange-dim', text: 'text-orange',  border: 'border-orange/20' },
  off:     { label: 'Off',     color: 'gray',   bg: 'bg-surface2',   text: 'text-muted',   border: 'border-border'    },
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const ROLES = ['Head Chef','Sous Chef','Waiter','Cashier','Delivery','Cleaner','Kitchen','Barista']

// ── Attendance Calendar ────────────────────────────────────────────────────
function AttendanceCalendar({ staffId }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year,  setYear]  = useState(today.getFullYear())

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', staffId, month, year],
    queryFn: () => getAttendance(staffId, month, year),
  })

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay    = new Date(year, month - 1, 1).getDay() // 0=Sun
  const logMap      = {}
  ;(data?.logs || []).forEach(l => { logMap[l.date] = l })

  const summary = data?.summary || { present: 0, leave: 0, off: 0 }

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors">
          <ChevronLeft size={16}/>
        </button>
        <h3 className="font-display font-bold text-sm text-text">
          {MONTH_NAMES[month-1]} {year}
        </h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors"
          disabled={month === today.getMonth()+1 && year === today.getFullYear()}>
          <ChevronRight size={16}/>
        </button>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Present', val: summary.present, color: 'text-green2', bg: 'bg-green-dim' },
          { label: 'Leave',   val: summary.leave,   color: 'text-orange',  bg: 'bg-orange-dim' },
          { label: 'Off',     val: summary.off,     color: 'text-muted',   bg: 'bg-surface2' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`font-display font-black text-xl ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-muted py-1">{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({length: firstDay}).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({length: daysInMonth}, (_, i) => {
              const day     = i + 1
              const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const log     = logMap[dateStr]
              const isToday = dateStr === today.toISOString().slice(0,10)
              const isFuture = new Date(dateStr) > today

              return (
                <div key={day}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-bold transition-all ${
                    isFuture ? 'bg-surface2 text-border2' :
                    log?.status === 'present' ? 'bg-green-dim text-green2 border border-green/20' :
                    log?.status === 'leave'   ? 'bg-orange-dim text-orange border border-orange/20' :
                    log?.status === 'off'     ? 'bg-surface2 text-muted border border-border' :
                    'bg-surface2 text-muted border border-dashed border-border2'
                  } ${isToday ? 'ring-2 ring-green ring-offset-1' : ''}`}
                  title={log ? `${log.status}${log.notes ? ' — '+log.notes : ''}` : dateStr}>
                  {day}
                  {log && <span className="text-[8px] mt-0.5 opacity-70">
                    {log.status === 'present' ? '✓' : log.status === 'leave' ? 'L' : '—'}
                  </span>}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 justify-center flex-wrap">
            {[
              ['bg-green-dim border-green/20 text-green2','✓ Present'],
              ['bg-orange-dim border-orange/20 text-orange','L Leave'],
              ['bg-surface2 border-border text-muted','— Off'],
              ['bg-surface2 border-dashed border-border2 text-muted','Not marked'],
            ].map(([cls, lbl]) => (
              <div key={lbl} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded border text-[8px] flex items-center justify-center font-bold ${cls}`} />
                <span className="text-[10px] text-muted">{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Staff Page ────────────────────────────────────────────────────────
export default function Staff() {
  const qc = useQueryClient()
  const [selected,   setSelected]   = useState(null)
  const [addModal,   setAddModal]   = useState(false)
  const [editModal,  setEditModal]  = useState(null)
  const [noteModal,  setNoteModal]  = useState(null) // {member, status}
  const [note,       setNote]       = useState('')
  const [form,       setForm]       = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: staff, isLoading } = useQuery({ queryKey: ['staff'], queryFn: getStaff })

  const refetch = () => qc.invalidateQueries({ queryKey: ['staff'] })

  const createMut = useMutation({
    mutationFn: createStaff,
    onSuccess: () => { toast.success('Staff added!'); refetch(); setAddModal(false); setForm({}) },
    onError: e => toast.error(String(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }) => updateStaff(id, body),
    onSuccess: () => { toast.success('Updated!'); refetch(); setEditModal(null) },
    onError: e => toast.error(String(e)),
  })

  const attendMut = useMutation({
    mutationFn: ({ id, status, notes }) => markAttendance(id, { status, notes }),
    onSuccess: (_, vars) => {
      toast.success(`Marked ${vars.status}!`)
      refetch()
      qc.invalidateQueries({ queryKey: ['attendance', vars.id] })
      setNoteModal(null)
      setNote('')
      if (selected?.id === vars.id) setSelected(s => ({ ...s, status: vars.status }))
    },
    onError: e => toast.error(String(e)),
  })

  const deleteMut = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => { toast.success('Staff removed!'); refetch(); setSelected(null) },
    onError: e => toast.error(String(e)),
  })

  const totalStaff   = (staff||[]).length
  const presentCount = (staff||[]).filter(s => s.status === 'present').length
  const leaveCount   = (staff||[]).filter(s => s.status === 'leave').length
  const totalPayroll = (staff||[]).reduce((s, m) => s + (m.salary || 0), 0)

  // ── Profile view ────────────────────────────────────────────────────────
  if (selected) {
    const cfg = STATUS_CONFIG[selected.status] || STATUS_CONFIG.present
    return (
      <div className="space-y-4 animate-fadeUp">
        <button onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm text-text3 hover:text-text transition-colors">
          <ArrowLeft size={15}/> Back to staff
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile card */}
          <Card className="lg:col-span-1 space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
                style={{ background: avatarColor(selected.id) }}>
                {initials(selected.name)}
              </div>
              <h2 className="font-display font-bold text-lg text-text">{selected.name}</h2>
              <p className="text-sm text-muted">{selected.role}</p>
              {selected.phone && (
                <p className="text-xs text-muted flex items-center justify-center gap-1 mt-1">
                  <Phone size={11}/>{selected.phone}
                </p>
              )}
              <div className="mt-2">
                <Badge color={cfg.color}>{cfg.label}</Badge>
              </div>
            </div>

            <div className="bg-surface2 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted uppercase font-bold tracking-wide mb-1">Monthly Salary</p>
              <p className="font-display font-black text-xl text-green2">{formatINR(selected.salary)}</p>
            </div>

            {/* Mark attendance */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">Mark Today's Attendance</p>
              <div className="grid grid-cols-3 gap-1.5">
                {['present','leave','off'].map(s => {
                  const c = STATUS_CONFIG[s]
                  return (
                    <button key={s}
                      onClick={() => {
                        if (s === 'leave') { setNoteModal({ member: selected, status: s }); return }
                        attendMut.mutate({ id: selected.id, status: s, notes: null })
                      }}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        selected.status === s
                          ? `${c.bg} ${c.text} ${c.border}`
                          : 'bg-surface2 text-muted border-border hover:border-green hover:text-green'
                      }`}>
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1 justify-center" icon={<Pencil size={13}/>}
                onClick={() => { setForm({...selected}); setEditModal(selected) }}>
                Edit
              </Button>
              <Button variant="danger" size="sm" className="flex-1 justify-center" icon={<Trash2 size={13}/>}
                onClick={() => { if(confirm('Remove this staff member?')) deleteMut.mutate(selected.id) }}>
                Remove
              </Button>
            </div>
          </Card>

          {/* Attendance calendar */}
          <Card className="lg:col-span-2">
            <h3 className="font-display font-bold text-sm text-text mb-4">Attendance History</h3>
            <AttendanceCalendar staffId={selected.id} staffName={selected.name} />
          </Card>
        </div>

        {/* Leave note modal */}
        <Modal open={!!noteModal} onClose={() => setNoteModal(null)} title="📝 Mark Leave">
          <div className="space-y-3">
            <p className="text-sm text-text2">Add a reason for <strong>{noteModal?.member?.name}'s</strong> leave today (optional):</p>
            <Input label="Reason" placeholder="e.g. Sick leave, Personal work..."
              value={note} onChange={e => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setNoteModal(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1 justify-center"
                loading={attendMut.isPending}
                onClick={() => attendMut.mutate({ id: noteModal.member.id, status: 'leave', notes: note || null })}>
                Mark Leave
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // ── Staff list ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff',    val: totalStaff,              color: 'text-text'   },
          { label: 'Present Today',  val: presentCount,            color: 'text-green2' },
          { label: 'On Leave',       val: leaveCount,              color: 'text-orange' },
          { label: 'Monthly Payroll',val: formatINR(totalPayroll), color: 'text-blue'   },
        ].map(k => (
          <Card key={k.label}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">{k.label}</p>
            <p className={`font-display font-black text-2xl ${k.color}`}>{k.val}</p>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Click any staff member to view attendance history</p>
        <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={() => { setForm({}); setAddModal(true) }}>
          Add Staff
        </Button>
      </div>

      {/* Staff grid */}
      {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg"/></div>
        : (staff||[]).length === 0
          ? <EmptyState icon="👨‍🍳" title="No staff yet" description="Add your first team member" />
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(staff||[]).map((member, i) => {
                const cfg = STATUS_CONFIG[member.status] || STATUS_CONFIG.present
                return (
                  <Card key={member.id} hover className="text-center cursor-pointer"
                    onClick={() => setSelected(member)}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white mx-auto mb-2"
                      style={{ background: avatarColor(i) }}>
                      {initials(member.name)}
                    </div>
                    <p className="font-display font-bold text-sm text-text">{member.name}</p>
                    <p className="text-xs text-muted mb-2">{member.role}</p>
                    <Badge color={cfg.color}>{cfg.label}</Badge>
                    <p className="text-xs text-muted mt-2">{formatINR(member.salary)}/mo</p>

                    {/* Quick attendance buttons */}
                    <div className="flex gap-1.5 mt-3 justify-center" onClick={e => e.stopPropagation()}>
                      {['present','leave','off'].map(s => (
                        <button key={s}
                          onClick={() => {
                            if (s === 'leave') { setNoteModal({ member, status: s }); return }
                            attendMut.mutate({ id: member.id, status: s, notes: null })
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                            member.status === s
                              ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} ${STATUS_CONFIG[s].border}`
                              : 'bg-surface2 text-muted border-border hover:bg-surface3'
                          }`}>
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

      {/* Add staff modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="➕ Add Staff Member"
        footer={<>
          <Button variant="secondary" onClick={() => setAddModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending}
            onClick={() => {
              if (!form.name || !form.role) { toast.error('Name and role required'); return }
              createMut.mutate({ name:form.name, role:form.role, phone:form.phone||null, salary:Number(form.salary)||0 })
            }}>Add</Button>
        </>}>
        <div className="space-y-3">
          <Input label="Full Name" placeholder="e.g. Anil Kumar" value={form.name||''} onChange={e=>set('name',e.target.value)} />
          <Select label="Role" value={form.role||''} onChange={e=>set('role',e.target.value)}>
            <option value="">Select role</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Phone" placeholder="+91 98765..." value={form.phone||''} onChange={e=>set('phone',e.target.value)} />
            <Input label="Monthly Salary (₹)" type="number" placeholder="18000" value={form.salary||''} onChange={e=>set('salary',e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="✏️ Edit Staff"
        footer={<>
          <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
          <Button variant="primary" loading={updateMut.isPending}
            onClick={() => updateMut.mutate({ id:editModal.id, name:form.name, role:form.role, phone:form.phone, salary:Number(form.salary)||0 })}>
            Save
          </Button>
        </>}>
        <div className="space-y-3">
          <Input label="Full Name" value={form.name||''} onChange={e=>set('name',e.target.value)} />
          <Select label="Role" value={form.role||''} onChange={e=>set('role',e.target.value)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Phone" value={form.phone||''} onChange={e=>set('phone',e.target.value)} />
            <Input label="Monthly Salary (₹)" type="number" value={form.salary||''} onChange={e=>set('salary',e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Leave note modal */}
      <Modal open={!!noteModal} onClose={() => setNoteModal(null)} title="📝 Mark Leave">
        <div className="space-y-3">
          <p className="text-sm text-text2">Add a reason for <strong>{noteModal?.member?.name}'s</strong> leave today (optional):</p>
          <Input label="Reason" placeholder="e.g. Sick leave, Personal work..."
            value={note} onChange={e => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setNoteModal(null)}>Cancel</Button>
            <Button variant="primary" className="flex-1 justify-center"
              loading={attendMut.isPending}
              onClick={() => attendMut.mutate({ id: noteModal.member.id, status: 'leave', notes: note || null })}>
              Mark Leave
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}