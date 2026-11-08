import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Brand from '../components/Brand'
import { Avatar } from '../components/ui'
import NotificationBell from './NotificationBell'
import { NAV } from './nav'
import { useAuth } from '../lib/auth'
import { ROLE_LABELS } from '../lib/constants'
import { displayName } from '../lib/format'

// Bottom-bar label: "My plots" → "Plots"
const shortLabel = (l) => { const s = l.replace(/^My /, ''); return s[0].toUpperCase() + s.slice(1) }

// Layout for landowners, farmers and buyers: floating top bar with a pill menu, like the public
// site, instead of the admin-style sidebar. Admins and verifiers keep AppLayout.
export default function UserLayout() {
  const { profile, role, signOut } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  const location = useLocation()
  const items = NAV[role] || []
  const main = items.filter((i) => !i.section)
  const community = items.filter((i) => i.section)
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4)

  useEffect(() => { setDrawer(false); setMenu(false); window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    const close = () => setMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <div className="fl-user-app">
      <header className="fl-user-top">
        <div className="fl-user-top-inner">
          <button type="button" className="btn btn-light rounded-circle p-0 fl-icon-btn d-lg-none" aria-label="Open menu" onClick={() => setDrawer(true)}><i className="bi bi-list fs-4" /></button>
          <Brand to="/dashboard" />
          <nav className="fl-user-nav d-none d-lg-flex mx-auto" aria-label="Main">
            {main.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/dashboard' || it.to === '/market'}><i className={`bi ${it.icon}`} /><span>{it.label}</span></NavLink>
            ))}
            {community.length > 0 && <span className="fl-user-nav-sep" aria-hidden="true" />}
            {community.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/market'} className="c" title={it.label} aria-label={it.label}><i className={`bi ${it.icon}`} /><span>{it.label}</span></NavLink>
            ))}
          </nav>
          <div className="ms-auto ms-lg-0 d-flex align-items-center gap-2">
            <NotificationBell />
            <div className="position-relative">
              <button type="button" className="btn btn-light rounded-pill d-flex align-items-center gap-2 p-1 pe-xl-3 border" aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu(!menu) }}>
                <Avatar profile={profile} size={32} />
                <span className="d-none d-xl-inline small fw-semibold">{profile?.full_name?.split(' ')[0]}</span>
              </button>
              {menu && (
                <div className="fl-dropdown shadow-lg py-2" style={{ width: 230 }} onClick={(e) => e.stopPropagation()}>
                  <div className="px-3 pb-2 border-bottom mb-1">
                    <div className="fw-semibold small">{displayName(profile)}</div>
                    <div className="small text-muted-fl">{ROLE_LABELS[role]}</div>
                  </div>
                  <Link className="dropdown-item" to="/profile"><i className="bi bi-person me-2" />Profile & settings</Link>
                  <Link className="dropdown-item" to={`/u/${profile?.id}`}><i className="bi bi-person-vcard me-2" />Public profile</Link>
                  <Link className="dropdown-item" to="/notifications"><i className="bi bi-bell me-2" />Notifications</Link>
                  <Link className="dropdown-item" to="/help"><i className="bi bi-question-circle me-2" />Help & support</Link>
                  <Link className="dropdown-item" to="/"><i className="bi bi-house me-2" />FarmLink home</Link>
                  <button type="button" className="dropdown-item text-danger" onClick={signOut}><i className="bi bi-box-arrow-right me-2" />Log out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawer && <div className="fl-backdrop d-lg-none" onClick={() => setDrawer(false)} aria-hidden="true" />}
      <aside className={`fl-sidebar fl-drawer d-lg-none ${drawer ? 'open' : ''}`} aria-hidden={!drawer}>
        <div className="px-3 pt-3 pb-4"><Brand reverse to="/dashboard" /></div>
        <nav className="px-2 d-grid gap-1" aria-label="Menu">
          {main.map((it) => <NavLink key={it.to} to={it.to} end={it.to === '/dashboard'} className="fl-side-link"><i className={`bi ${it.icon}`} /><span>{it.label}</span></NavLink>)}
          {community.length > 0 && <div className="fl-side-section">Community</div>}
          {community.map((it) => <NavLink key={it.to} to={it.to} className="fl-side-link"><i className={`bi ${it.icon}`} /><span>{it.label}</span></NavLink>)}
          <div className="fl-side-section">Account</div>
          <NavLink to="/help" className="fl-side-link"><i className="bi bi-question-circle" /><span>Help & support</span></NavLink>
          <NavLink to="/profile" className="fl-side-link"><i className="bi bi-person" /><span>Profile & settings</span></NavLink>
        </nav>
      </aside>

      {profile?.is_suspended && <div className="alert alert-warning mx-3">Your account is suspended. Contact the FarmLink administrator.</div>}

      <main className="fl-user-main">
        <Outlet />
      </main>

      <nav className="fl-bottombar d-lg-none" aria-label="Quick">
        {mobileItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/dashboard'} className="fl-bottom-link">
            <i className={`bi ${it.icon}`} /><span>{shortLabel(it.label)}</span>
          </NavLink>
        ))}
        <button type="button" className="fl-bottom-link border-0 bg-transparent" onClick={() => setDrawer(true)}>
          <i className="bi bi-three-dots" /><span>More</span>
        </button>
      </nav>
    </div>
  )
}
