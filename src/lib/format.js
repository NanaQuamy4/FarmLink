export const fmtNumber = (n, max = 2) =>
  n === null || n === undefined || n === '' ? '–' : Number(n).toLocaleString('en-GH', { maximumFractionDigits: max })

export const fmtCedis = (n) => (n === null || n === undefined ? '–' : `GH₵ ${fmtNumber(n, 2)}`)

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'

export function timeAgo(d) {
  if (!d) return ''
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} d ago`
  return fmtDate(d)
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

export const displayName = (p) => (p ? (p.is_group && p.group_name ? p.group_name : p.full_name) : '')

// Matches the Supabase Auth password rules: 8+ characters with lowercase, uppercase and a digit
export const PASSWORD_HINT = 'At least 8 characters, with uppercase and lowercase letters and a number.'
export const passwordProblem = (pw) =>
  (pw.length < 8 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) ? `Password needs ${PASSWORD_HINT.charAt(0).toLowerCase()}${PASSWORD_HINT.slice(1)}` : null)

// Links from the database are only followed when they are plain web links or site paths
export const safeWebUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : null)
export const safeAppPath = (p) => (typeof p === 'string' && /^\/(?!\/)/.test(p) && !p.includes('\\') ? p : null)
