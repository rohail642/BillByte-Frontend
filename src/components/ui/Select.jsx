import { clsx } from 'clsx'

export default function Select({ label, children, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-text2">{label}</label>}
      <select className={clsx(
        'w-full bg-bg border border-border2 text-text rounded-lg px-3 py-2 text-sm outline-none cursor-pointer',
        'transition-all duration-150 focus:border-green focus:ring-2 focus:ring-green/10',
        className
      )} {...props}>
        {children}
      </select>
    </div>
  )
}
