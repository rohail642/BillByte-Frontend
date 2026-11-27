import { useState } from 'react'
import { clsx } from 'clsx'
import { dishPhotoUrl } from './photoUtils'

// A dish's photo, if the restaurant uploaded one. Renders nothing otherwise
// (callers show the veg/non-veg mark instead), or if the photo fails to load.
export default function DishPhoto({ item, className, alt }) {
  const [failed, setFailed] = useState(false)
  const src = dishPhotoUrl(item)
  if (!src || failed) return null
  return (
    <img src={src} alt={alt ?? item.name} loading="lazy" decoding="async" onError={() => setFailed(true)}
      className={clsx('object-cover bg-surface2', className)} />
  )
}
