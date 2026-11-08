import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { supabase, errorMessage } from '../../lib/supabase'

const DEMO = [
  ['Landowner', 'ama@farmlink.test'],
  ['Farmer', 'kwame@farmlink.test'],
  ['Farmer group', 'group@farmlink.test'],
  ['Verifier', 'officer@farmlink.test'],
  ['Admin', 'admin@farmlink.test'],
  ['Buyer', 'buyer@farmlink.test'],
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const showDemo = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true'

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) return setError(errorMessage(err))
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your plots, deals and seasons.">
      <form onSubmit={submit} className="d-grid gap-3" noValidate>
        {error && <div className="alert alert-danger py-2 mb-0" role="alert">{error}</div>}
        <div>
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="form-control" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="d-flex justify-content-between"><label className="form-label" htmlFor="password">Password</label><Link to="/forgot-password" className="small">Forgot password?</Link></div>
          <input id="password" type="password" className="form-control" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !email || !password}>
          {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}Log in
        </button>
        <p className="text-center text-muted-fl mb-0">New to FarmLink? <Link to="/register">Create an account</Link></p>
      </form>

      {showDemo && (
        <div className="fl-card mt-4 p-3">
          <div className="small fw-semibold mb-2"><i className="bi bi-person-badge me-1" />Demo accounts · password FarmLink#2026</div>
          <div className="d-flex flex-wrap gap-2">
            {DEMO.map(([label, mail]) => (
              <button key={mail} type="button" className="fl-pill border-0" onClick={() => { setEmail(mail); setPassword('FarmLink#2026') }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
