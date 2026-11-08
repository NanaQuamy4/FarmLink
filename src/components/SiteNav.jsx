import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Brand from './Brand'

const links = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/#landowners', label: 'Landowners' },
  { href: '/#calculator', label: 'Harvest split' },
  { href: '/#faq', label: 'FAQ' },
]

// Public site navigation. `overlay` floats over the hero photo with white text,
// then fills in with deep green once the page is scrolled.
export default function SiteNav({ overlay = false }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!overlay) return undefined
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])

  const navClass = overlay
    ? `fl-nav-fixed${scrolled ? ' scrolled' : ''}${open ? ' menu-open' : ''}`
    : 'bg-white border-bottom'
  const tone = overlay ? 'text-white' : 'text-body'

  return (
    <nav className={`navbar navbar-expand-lg ${navClass}`}>
      <div className="container">
        <Brand reverse={overlay} />
        <button
          className={`navbar-toggler border-0 ${overlay ? 'text-white' : ''}`}
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'} fs-2`} />
        </button>
        <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
          <ul className={`navbar-nav mx-auto fl-nav-links ${tone} ${overlay ? 'fl-nav-pill my-3 my-lg-0' : ''}`}>
            {links.map((l) => (
              <li className="nav-item" key={l.href}>
                <a className="nav-link" href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="d-flex gap-2 align-items-center pb-3 pb-lg-0">
            <NavLink to="/login" className={`btn ${overlay ? 'btn-outline-light-fl' : 'btn-outline-primary'}`}>Log in</NavLink>
            <Link to="/register" className="btn btn-lime">Get started</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
