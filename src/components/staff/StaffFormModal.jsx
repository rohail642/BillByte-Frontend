import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { JOB_TITLES, WEEKDAYS, roleLabel, localDay } from './staffUtils'

// Add (member = null) or edit a staff record.
export default function StaffFormModal({ open, member, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => init(member))
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.name.trim()) return setError('Enter a name')
    if (!form.role) return setError('Choose a role')
    setError('')
    onSave({
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim() || null,
      salary: Number(form.salary) || 0,
      join_date: form.join_date || null,
      weekly_off: form.weekly_off === '' ? null : Number(form.weekly_off),
      notes: form.notes.trim() || null,
    })
  }

  // Older records may hold a login-style role ("waiter"); show it as its job title.
  const roleOptions = JOB_TITLES.includes(form.role) || !form.role ? JOB_TITLES : [form.role, ...JOB_TITLES]

  return (
    <Modal open={open} onClose={onClose} title={member ? `Edit ${member.name}` : 'Add staff member'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={submit}>{member ? 'Save' : 'Add'}</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Full name" placeholder="e.g. Anil Kumar" value={form.name} maxLength={200}
          onChange={e => set('name', e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="">Select role</option>
            {roleOptions.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </Select>
          <Input label="Phone" placeholder="98765 43210" value={form.phone} maxLength={20}
            onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Monthly salary (₹)" type="number" min="0" placeholder="18000" value={form.salary}
            onChange={e => set('salary', e.target.value)} />
          <Input label="Joining date" type="date" value={form.join_date}
            onChange={e => set('join_date', e.target.value)} />
        </div>
        <Select label="Weekly off" value={form.weekly_off} onChange={e => set('weekly_off', e.target.value)}>
          <option value="">No fixed day</option>
          {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </Select>
        <Input label="Notes (optional)" placeholder="e.g. Night shift, uniform deposit ₹500" value={form.notes} maxLength={500}
          onChange={e => set('notes', e.target.value)} />
        <p className="text-[11px] text-muted">Salary for days before the joining date isn't paid. The weekly off day counts as a paid day off.</p>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
    </Modal>
  )
}

function init(m) {
  return {
    name: m?.name || '',
    role: m?.role || '',
    phone: m?.phone || '',
    salary: m?.salary ? String(m.salary) : '',
    join_date: localDay(m?.join_date),
    weekly_off: m?.weekly_off ?? '',
    notes: m?.notes || '',
  }
}
