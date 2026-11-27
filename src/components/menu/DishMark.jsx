import { clsx } from 'clsx'

// Indian food-type mark: a square outline with a green dot (veg), a red
// triangle (non-veg) or an amber dot (egg). Nothing for "not applicable".
export default function DishMark({ type, size = 14, className }) {
  if (!type || type === 'na') return null
  const nonVeg = type === 'non_veg'
  const egg = type === 'egg'
  const color = nonVeg ? 'border-red' : egg ? 'border-amber' : 'border-green'
  const label = nonVeg ? 'Non-vegetarian' : egg ? 'Contains egg' : 'Vegetarian'
  const inner = Math.round(size * 0.45)
  return (
    <span role="img" aria-label={label} title={label}
      className={clsx('inline-flex items-center justify-center flex-shrink-0 rounded-[3px] border-[1.5px] bg-white', color, className)}
      style={{ width: size, height: size }}>
      {nonVeg ? (
        <span style={{ width: 0, height: 0, borderLeft: `${inner * 0.6}px solid transparent`, borderRight: `${inner * 0.6}px solid transparent`, borderBottom: `${inner}px solid var(--red)` }} />
      ) : (
        <span className={clsx('rounded-full', egg ? 'bg-amber' : 'bg-green')} style={{ width: inner, height: inner }} />
      )}
    </span>
  )
}
