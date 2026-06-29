import { clsx } from 'clsx'

export default function Card({ children, className, hover, ...props }) {
  return (
    <div className={clsx(
      'bg-surface border border-border rounded-xl p-4',
      hover && 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      className
    )} {...props}>
      {children}
    </div>
  )
}
