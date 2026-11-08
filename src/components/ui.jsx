import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { photoUrl } from '../lib/storage'
import { initials } from '../lib/format'

export function StatusBadge({ map, value }) {
  const [label, cls] = map[value] || [value, 'neutral']
  return <span className={`fl-status ${cls}`}>{label}</span>
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="d-flex align-items-center gap-2 text-muted-fl py-5 justify-content-center" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorAlert({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3" role="alert">
      <span><i className="bi bi-exclamation-triangle me-2" />{error}</span>
      {onRetry && <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function EmptyState({ icon = 'bi-inbox', title, text, action }) {
  return (
    <div className="text-center py-5 px-3">
      <span className="fl-icon-tile soft mb-3" style={{ width: 56, height: 56, fontSize: '1.5rem' }}><i className={`bi ${icon}`} /></span>
      <h3 className="h5">{title}</h3>
      {text && <p className="text-muted-fl mx-auto" style={{ maxWidth: 420 }}>{text}</p>}
      {action}
    </div>
  )
}

// Page title. With `image` it becomes a photo hero (rounded photo, green gradient, frosted stat
// cards) in the style of the landing page; `accent` is shown in the italic serif after the title.
export function PageHeader({ eyebrow, title, accent, text, actions, image, imagePosition, photo, tall, stats, children }) {
  if (image || photo) {
    return (
      <header className={`fl-page-hero fl-on-dark${tall ? ' tall' : ''}`}>
        {photo ? <Photo path={photo.path} bucket={photo.bucket} alt="" /> : <img src={image} alt="" style={imagePosition ? { objectPosition: imagePosition } : undefined} />}
        <div className="fl-page-hero-body">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
            <div style={{ maxWidth: 720 }}>
              {eyebrow && <span className="fl-pill dark mb-3 fl-enter">{eyebrow}</span>}
              <h1 className="mb-2 fl-enter d1">{title}{accent && <> <span className="fl-serif text-lime">{accent}</span></>}</h1>
              {text && <p className="mb-0 fl-enter d2" style={{ opacity: 0.85, maxWidth: 560 }}>{text}</p>}
            </div>
            {actions && <div className="d-flex flex-wrap gap-2 fl-enter d3">{actions}</div>}
          </div>
          {stats && (
            <div className="fl-hero-stats fl-enter d3">
              {stats.map((s) => {
                const body = (
                  <>
                    <span className="d-flex align-items-center gap-2 small" style={{ opacity: 0.85 }}><i className={`bi ${s.icon}`} />{s.label}</span>
                    <span className="fl-hero-stat-value">{s.value}</span>
                  </>
                )
                return s.to
                  ? <Link key={s.label} to={s.to} className={`fl-hero-stat${s.highlight ? ' lime' : ''}`}>{body}</Link>
                  : <div key={s.label} className={`fl-hero-stat${s.highlight ? ' lime' : ''}`}>{body}</div>
              })}
            </div>
          )}
          {children}
        </div>
      </header>
    )
  }
  return (
    <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
      <div>
        {eyebrow && <span className="fl-eyebrow mb-2">{eyebrow}</span>}
        <h1 className="h2 mb-1">{title}</h1>
        {text && <p className="text-muted-fl mb-0">{text}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ icon, label, value, to, tone }) {
  const body = (
    <div className={`fl-card fl-lift d-flex align-items-center gap-3 p-3 ${tone === 'dark' ? 'bg-deep text-white border-0' : ''}`}>
      <span className={`fl-icon-tile ${tone === 'dark' ? '' : 'soft'}`}><i className={`bi ${icon}`} /></span>
      <div>
        <div className="fs-3 fw-semibold lh-1" style={{ fontFamily: 'Outfit' }}>{value}</div>
        <div className={`small ${tone === 'dark' ? 'text-white-50' : 'text-muted-fl'}`}>{label}</div>
      </div>
    </div>
  )
  return to ? <Link to={to} className="text-decoration-none text-reset d-block">{body}</Link> : body
}

export function Avatar({ profile, size = 40 }) {
  const name = profile?.is_group ? profile.group_name : profile?.full_name
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" width={size} height={size} className="rounded-circle object-fit-cover flex-none" />
  }
  return (
    <span className="rounded-circle d-inline-grid flex-none fw-semibold" aria-hidden="true"
      style={{ width: size, height: size, placeItems: 'center', background: '#E8F3D2', color: 'var(--fl-deep)', fontSize: size * 0.38 }}>
      {profile?.is_group ? <i className="bi bi-people-fill" /> : initials(name)}
    </span>
  )
}

// Image from a storage path (signed URL) or a site path
export function Photo({ path, bucket, alt = '', className = '', style }) {
  const [src, setSrc] = useState(path?.startsWith('/') ? path : null)
  useEffect(() => {
    let live = true
    if (path && !path.startsWith('/')) photoUrl(path, bucket).then((u) => live && setSrc(u))
    else setSrc(path || null)
    return () => { live = false }
  }, [path, bucket])
  if (!src) return <div className={`bg-light ${className}`} style={{ ...style, background: '#E8EDE3' }} aria-hidden="true" />
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" />
}

// Button that runs an async action with a spinner and reports errors through onError
export function ActionButton({ onClick, children, className = 'btn btn-primary', confirm, disabled, ...rest }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className={className}
      disabled={busy || disabled}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return
        setBusy(true)
        try { await onClick() } finally { setBusy(false) }
      }}
      {...rest}
    >
      {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function Field({ label, htmlFor, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="form-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="form-text">{hint}</div>}
    </div>
  )
}
