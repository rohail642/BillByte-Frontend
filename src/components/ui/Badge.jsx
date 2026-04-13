import { clsx } from 'clsx'

const colorMap = {
  green:  'bg-green-dim text-green2',
  orange: 'bg-orange-dim text-orange',
  blue:   'bg-blue-dim text-blue',
  amber:  'bg-amber-dim text-amber',
  red:    'bg-red-dim text-red',
  purple: 'bg-purple-dim text-purple',
  gray:   'bg-surface2 text-text3',
}

export default function Badge({ children, color = 'gray', dot, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
      colorMap[color], className
    )}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
