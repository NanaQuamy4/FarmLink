import { supabase } from './supabase'

// Paths starting with "/" are site images (demo data). Everything else is a key in a private
// bucket and is shown through a short-lived signed URL.
const cache = new Map()

export async function photoUrl(path, bucket = 'plot-photos') {
  if (!path) return null
  if (path.startsWith('/') || path.startsWith('http')) return path
  const k = `${bucket}/${path}`
  const hit = cache.get(k)
  if (hit && hit.expires > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error) return null
  cache.set(k, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}

// Shrinks a photo in the browser before upload (slow connections, free-tier storage).
export async function compressImage(file, maxSide = 1400, quality = 0.72) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file
}

export async function uploadPhoto(bucket, folder, file) {
  const small = await compressImage(file)
  const ext = small.type === 'application/pdf' ? 'pdf' : 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, small, { contentType: small.type, upsert: false })
  if (error) throw error
  return path
}
