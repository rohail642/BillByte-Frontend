import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DishMark from './DishMark'
import { compressPhoto, dishPhotoUrl } from './photoUtils'

// Optional dish photo in the add/edit form. `value` is undefined (no change),
// a compressed Blob (new photo) or 'remove'. Without a photo, menus show the
// veg/non-veg mark instead.
export default function PhotoField({ item, foodType, value, onChange }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)   // object URL of a newly picked photo
  const previewRef = useRef(null)
  const setPreviewUrl = url => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  const existing = value === 'remove' ? null : dishPhotoUrl(item)
  const shown = (value instanceof Blob && preview) || existing

  const pick = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressPhoto(file)
      setPreviewUrl(URL.createObjectURL(blob))
      onChange(blob)
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-text2 mb-1">Photo <span className="font-normal text-muted">(optional)</span></p>
      <div className="flex items-center gap-3">
        <div className="w-20 h-16 rounded-lg border border-border2 bg-surface2 overflow-hidden flex items-center justify-center flex-shrink-0">
          {busy ? <Loader2 size={18} className="animate-spin text-muted" />
            : shown ? <img src={shown} alt="" className="w-full h-full object-cover" />
            : <DishMark type={foodType} size={18} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="h-8 px-3 rounded-lg border border-border2 text-xs font-semibold text-text2 hover:border-green hover:text-green2 flex items-center gap-1.5 disabled:opacity-50">
            <ImagePlus size={14} /> {shown ? 'Change photo' : 'Add photo'}
          </button>
          {shown && (
            <button type="button" onClick={() => { setPreviewUrl(null); onChange(item?.image_version ? 'remove' : undefined) }}
              className="h-8 px-3 rounded-lg border border-border2 text-xs font-semibold text-text3 hover:border-red hover:text-red flex items-center gap-1.5">
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
      </div>
      <p className="text-[11px] text-muted mt-1">Shown on the POS and the guest QR menu. Without a photo, the veg / non-veg mark is shown.</p>
    </div>
  )
}
