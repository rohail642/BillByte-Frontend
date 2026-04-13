import { clsx } from 'clsx'

export default function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-text2">{label}</label>}
      <input className={clsx(
        'w-full bg-bg border border-border2 text-text rounded-lg px-3 py-2 text-sm outline-none',
        'transition-all duration-150 placeholder:text-muted',
        'focus:border-green focus:ring-2 focus:ring-green/10',
        error && 'border-red focus:border-red focus:ring-red/10',
        className
      )} {...props} />
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  )
}
