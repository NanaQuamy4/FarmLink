import Brand from '../../components/Brand'

// Split screen for login and registration: photo panel on large screens, form on the right.
export default function AuthLayout({ title, subtitle, children, image = '/images/auth-green-field.jpg', quote }) {
  return (
    <div className="min-vh-100 d-flex p-2 p-md-3 gap-3">
      <aside className="d-none d-lg-flex position-relative overflow-hidden rounded-fl-xl flex-column justify-content-between p-5 text-white" style={{ flex: '0 0 44%', isolation: 'isolate' }}>
        <img src={image} alt="" className="position-absolute top-0 start-0 fl-cover" style={{ zIndex: -2 }} />
        <div className="position-absolute top-0 start-0 w-100 h-100" style={{ zIndex: -1, background: 'linear-gradient(180deg, rgba(3,43,31,.55), rgba(3,43,31,.2) 40%, rgba(3,43,31,.85))' }} />
        <Brand reverse />
        <div className="fl-enter">
          <p className="fl-h-section text-white mb-3" style={{ fontFamily: 'Outfit', fontWeight: 600 }}>
            {quote || <>Idle land. Young farmers. <span className="fl-serif text-lime">One fair harvest.</span></>}
          </p>
          <p className="text-white-50 mb-0">Every plot verified. Every term recorded. Every harvest shared as agreed.</p>
        </div>
      </aside>
      <main className="flex-grow-1 d-flex flex-column">
        <div className="d-lg-none p-3"><Brand /></div>
        <div className="flex-grow-1 d-flex align-items-center justify-content-center py-4 px-3">
          <div className="w-100 fl-enter" style={{ maxWidth: 460 }}>
            <h1 className="h2 mb-1">{title}</h1>
            {subtitle && <p className="text-muted-fl mb-4">{subtitle}</p>}
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
