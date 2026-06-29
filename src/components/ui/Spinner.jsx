import { clsx } from 'clsx'
export default function Spinner({ size = 'md', className }) {
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size]
  return <span className={clsx(sz,'border-2 border-border2 border-t-green rounded-full animate-spin inline-block', className)} />
}
