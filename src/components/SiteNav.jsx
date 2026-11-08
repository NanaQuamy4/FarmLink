import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Brand from './Brand'

const links = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#landowners', label: 'Landowners' },
  { href: '/#farmers', label: 'Farmers' },
  { href: '/#calculator', label: 'Harvest split' },
  { href: '/#faq', label: 'FAQ' },
]

// Public site navigation. `overlay` sits on top of the hero photo with white text.
export default function SiteNav({ overlay = false }) {
  const [open, setOpen] = useState(false)
  const tone = overlay ? 'text-white' : 'text-body'

  return (
    <nav className={`navbar navbar-expand-lg ${overlay ? 'position-absolute top-0 start-0 end-0 z-3' : 'bg-white border-bottom'}`}>
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
