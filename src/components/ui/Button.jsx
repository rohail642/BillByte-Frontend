import { clsx } from 'clsx'

const variants = {
  primary:   'bg-green text-white hover:bg-green2 shadow-sm hover:-translate-y-px active:translate-y-0',
  secondary: 'bg-surface2 border border-border2 text-text2 hover:border-green hover:text-green hover:bg-green-dim',
  danger:    'bg-red-dim border border-red/20 text-red hover:bg-red/15',
  ghost:     'text-text3 hover:text-text hover:bg-surface2',
}

const sizes = {
  xs: 'px-2.5 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

export default function Button({
  children, variant = 'secondary', size = 'md',
  className, loading, icon, iconRight, ...props
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
      {iconRight && !loading && iconRight}
    </button>
  )
}
