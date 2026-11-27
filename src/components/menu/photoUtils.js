import { API_URL } from '../../api/client'

// Public, versioned (cache-forever) URL of a dish photo, or null if it has none.
export function dishPhotoUrl(item) {
  return item?.image_version ? `${API_URL}/public/menu-image/${item.id}/${item.image_version}` : null
}

// Shrink a picked photo in the browser before upload: longest side 720 px,
// WebP (JPEG where WebP encoding isn't supported), aiming for ≈50–150 KB.
// The server rejects anything over 300 KB.
export async function compressPhoto(file, maxSide = 720) {
  if (!file?.type?.startsWith('image/')) throw new Error('Please choose a photo (JPEG, PNG or WebP).')
  const bitmap = await loadImage(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)   // transparent PNGs → white, not black
  ctx.drawImage(bitmap, 0, 0, w, h)
  for (const [type, q] of [['image/webp', 0.82], ['image/webp', 0.7], ['image/jpeg', 0.8], ['image/jpeg', 0.65]]) {
    const blob = await new Promise(res => canvas.toBlob(res, type, q))
    if (blob && blob.type === type && blob.size <= 280 * 1024) return blob
  }
  throw new Error('That photo is too large even after compressing. Try a smaller one.')
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')) }
    img.src = url
  })
}
