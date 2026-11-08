import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Brand from '../components/Brand'
import { Avatar } from '../components/ui'
import NotificationBell from './NotificationBell'
import { NAV } from './nav'
import { useAuth } from '../lib/auth'
import { ROLE_LABELS } from '../lib/constants'
import { displayName } from '../lib/format'

function NavList({ items, onNavigate }) {
  let lastSection
  return (
    <nav className="d-grid gap-1" aria-label="Main">
      {items.map((it) => {
        const header = it.section && it.section !== lastSection ? it.section : null
        lastSection = it.section
        return (
          <div key={it.to + it.label}>
            {header && <div className="fl-side-section">{header}</div>}
            <NavLink to={it.to} end={it.to === '/dashboard' || it.to === '/market' || it.to === '/verify'} className="fl-side-link" onClick={onNavigate}>
              <i className={`bi ${it.icon}`} /><span>{it.label}</span>
            </NavLink>
          </div>
        )
      })}
    </nav>
  )
}

export default function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  const location = useLocation()
  const items = NAV[role] || []
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4)

  useEffect(() => { setDrawer(false); setMenu(false); window.scrollTo(0, 0) }, [location.pathname])

  const sidebar = (
    <>
      <div className="px-3 pt-3 pb-4"><Brand reverse to="/dashboard" /></div>
      <div className="px-2 flex-grow-1 overflow-auto"><NavList items={items} onNavigate={() => setDrawer(false)} /></div>
      <div className="p-3">
        <div className="fl-side-user">
          <Avatar profile={profile} size={36} />
          <div className="min-w-0 flex-grow-1">
            <div className="fw-semibold text-white text-truncate small">{displayName(profile)}</div>
            <div className="small text-white-50">{ROLE_LABELS[role]}</div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="fl-app">
      {/* Desktop sidebar */}
      <aside className="fl-sidebar d-none d-lg-flex">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && <div className="fl-backdrop d-lg-none" onClick={() => setDrawer(false)} aria-hidden="true" />}
      <aside className={`fl-sidebar fl-drawer d-lg-none ${drawer ? 'open' : ''}`} aria-hidden={!drawer}>{sidebar}</aside>

      <div className="fl-main">
        <header className="fl-topbar">
          <button type="button" className="btn btn-light rounded-circle p-0 fl-icon-btn d-lg-none" aria-label="Open menu" onClick={() => setDrawer(true)}><i className="bi bi-list fs-4" /></button>
          <div className="d-lg-none"><Brand to="/dashboard" /></div>
          <div className="ms-auto d-flex align-items-center gap-2">
            <NotificationBell />
            <div className="position-relative">
              <button type="button" className="btn btn-light rounded-pill d-flex align-items-center gap-2 p-1 pe-lg-3" aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu(!menu) }}>
                <Avatar profile={profile} size={32} />
                <span className="d-none d-lg-inline small fw-semibold">{profile?.full_name?.split(' ')[0]}</span>
                <i className="bi bi-chevron-down small d-none d-lg-inline" />
              </button>
              {menu && (
                <div className="fl-dropdown shadow-lg py-2" style={{ width: 220 }} onClick={(e) => e.stopPropagation()}>
                  <div className="px-3 pb-2 border-bottom mb-1">
                    <div className="fw-semibold small">{displayName(profile)}</div>
                    <div className="small text-muted-fl">{ROLE_LABELS[role]}</div>
                  </div>
                  <Link className="dropdown-item" to="/profile"><i className="bi bi-person me-2" />Profile & settings</Link>
                  <Link className="dropdown-item" to={`/u/${profile?.id}`}><i className="bi bi-person-vcard me-2" />Public profile</Link>
                  <Link className="dropdown-item" to="/notifications"><i className="bi bi-bell me-2" />Notifications</Link>
                  <Link className="dropdown-item" to="/"><i className="bi bi-house me-2" />FarmLink home</Link>
                  <button type="button" className="dropdown-item text-danger" onClick={signOut}><i className="bi bi-box-arrow-right me-2" />Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {profile?.is_suspended && (
          <div className="alert alert-warning m-3 mb-0">Your account is suspended. Contact the FarmLink administrator.</div>
        )}

        <main className="fl-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fl-bottombar d-lg-none" aria-label="Quick">
        {mobileItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/dashboard'} className="fl-bottom-link">
            <i className={`bi ${it.icon}`} /><span>{it.label.replace('My ', '')}</span>
          </NavLink>
        ))}
        <button type="button" className="fl-bottom-link border-0 bg-transparent" onClick={() => setDrawer(true)}>
          <i className="bi bi-three-dots" /><span>More</span>
        </button>
      </nav>
    </div>
  )
}
