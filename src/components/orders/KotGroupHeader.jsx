import { StickyNote } from 'lucide-react'
// Header + note for one order round in the waiter / cashier table panels.
export default function KotGroupHeader({ group, multiple }) {
  return (
    <>
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted flex-shrink-0">
          {multiple ? `Order ${group.kot}` : 'Current order'}
        </span>
        {group.label && <span className="text-[11px] font-semibold text-text2 truncate">· {group.label}</span>}
        {group.qr && <span className="text-[9px] font-bold uppercase bg-amber-dim text-amber rounded px-1 py-0.5 flex-shrink-0">QR</span>}
      </div>
      {group.note && (
        <p className="mx-2.5 mb-1 text-xs bg-amber-dim text-amber rounded-md px-2 py-1 break-words flex gap-1.5"><StickyNote size={12} className="flex-shrink-0 mt-0.5" /><span>{group.note}</span></p>
      )}
    </>
  )
}
