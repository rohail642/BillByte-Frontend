import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStaff, createStaff, updateStaff, deleteStaff } from '../api/staff'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Plus, Trash2, ChefHat, Users, IndianRupee, Calendar } from 'lucide-react'
import { formatINR, initials, avatarColor, statusColor } from '../utils'

const ROLES = ['Head Chef','Sous Chef','Waiter','Cashier','Delivery','Cleaner','Manager']

export default function Staff() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: staff, isLoading } = useQuery({ queryKey: ['staff'], queryFn: getStaff })
  const refetch = () => qc.invalidateQueries({ queryKey: ['staff'] })

  const createMut = useMutation({
    mutationFn: createStaff,
    onSuccess: () => { toast.success('Staff added!'); refetch(); setModal(false); setForm({}) },
    onError: e => toast.error(String(e)),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...body }) => updateStaff(id, body),
    onSuccess: () => { toast.success('Updated!'); refetch() },
    onError: e => toast.error(String(e)),
  })
  const deleteMut = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => { toast.success('Removed from staff.'); refetch() },
    onError: e => toast.error(String(e)),
  })

  const totalPayroll = (staff || []).reduce((s, m) => s + (m.salary || 0), 0)
  const present      = (staff || []).filter(m => m.status === 'present').length
  const onLeave      = (staff || []).filter(m => m.status === 'leave').length

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff',     val: (staff || []).length,   icon: Users,        color: 'green'  },
          { label: 'Present Today',   val: present,                icon: ChefHat,      color: 'blue'   },
          { label: 'On Leave',        val: onLeave,                icon: Calendar,     color: 'orange' },
          { label: 'Monthly Payroll', val: formatINR(totalPayroll),icon: IndianRupee,  color: 'amber'  },
        ].map(k => (
          <Card key={k.label} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `var(--${k.color}-dim)` }}>
              <k.icon size={16} style={{ color: `var(--${k.color})` }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{k.label}</p>
              <p className="font-display font-black text-lg leading-tight" style={{ color: `var(--${k.color})` }}>{k.val}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-display font-bold text-text">Team Members</h3>
        <Button variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={() => { setForm({ status: 'present' }); setModal(true) }}>
          Add Staff
        </Button>
      </div>

      {isLoading
        ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        : (staff || []).length === 0
          ? <Card><EmptyState icon="🧑‍🍳" title="No staff added yet" description="Add your team to manage attendance and payroll" /></Card>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {(staff || []).map((member, i) => (
                <Card key={member.id} hover className="text-center group relative">
                  {/* Delete */}
                  <button onClick={() => { if (confirm('Remove this staff member?')) deleteMut.mutate(member.id) }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-dim text-muted hover:text-red">
                    <Trash2 size={13} />
                  </button>

                  <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-bold text-sm mb-3"
                       style={{ background: avatarColor(i) }}>
                    {initials(member.name)}
                  </div>
                  <p className="font-semibold text-sm text-text mb-0.5">{member.name}</p>
                  <p className="text-xs text-muted mb-3">{member.role}</p>

                  <div className="flex justify-center gap-2 mb-3">
                    <Badge color={statusColor(member.status)}>{member.status}</Badge>
                  </div>

                  {member.salary > 0 && (
                    <p className="text-xs text-muted">{formatINR(member.salary)}/mo</p>
                  )}

                  {/* Status toggle */}
                  <div className="flex gap-1 mt-3 justify-center">
                    {['present','leave','off'].map(s => (
                      <button key={s} onClick={() => updateMut.mutate({ id: member.id, status: s })}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-all ${member.status === s ? 'bg-green-dim text-green2' : 'text-muted hover:text-text'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

      {/* Add staff modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Staff Member"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending}
            onClick={() => {
              if (!form.name || !form.role) { toast.error('Name and role required'); return }
              createMut.mutate({ name: form.name, role: form.role, phone: form.phone, email: form.email, salary: Number(form.salary) || 0, status: form.status || 'present' })
            }}>
            Add Member
          </Button>
        </>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input label="Full Name" placeholder="Anil Kumar" value={form.name || ''} onChange={e => set('name', e.target.value)} />
            <Select label="Role" value={form.role || ''} onChange={e => set('role', e.target.value)}>
              <option value="">Select role</option>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Phone" placeholder="+91 98765…" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            <Input label="Monthly Salary (₹)" type="number" placeholder="0" value={form.salary || ''} onChange={e => set('salary', e.target.value)} />
          </div>
          <Input label="Email (optional)" type="email" placeholder="anil@spicegarden.com" value={form.email || ''} onChange={e => set('email', e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
