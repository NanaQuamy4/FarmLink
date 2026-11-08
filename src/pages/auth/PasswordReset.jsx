import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { supabase, errorMessage } from '../../lib/supabase'
import { passwordProblem, PASSWORD_HINT } from '../../lib/format'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ busy: false, sent: false, error: '' })

  async function submit(e) {
    e.preventDefault()
    setState({ busy: true, sent: false, error: '' })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    setState({ busy: false, sent: !error, error: error ? errorMessage(error) : '' })
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We will email you a link to choose a new password.">
      {state.sent ? (
        <div className="alert alert-success">Check {email} for the reset link.</div>
      ) : (
        <form onSubmit={submit} className="d-grid gap-3">
          {state.error && <div className="alert alert-danger py-2 mb-0">{state.error}</div>}
          <div><label className="form-label" htmlFor="fp-email">Email</label><input id="fp-email" type="email" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn btn-primary btn-lg" disabled={state.busy || !email}>Send reset link</button>
        </form>
      )}
      <p className="text-center mt-3"><Link to="/login">Back to log in</Link></p>
    </AuthLayout>
  )
}

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (passwordProblem(password)) return setError(passwordProblem(password))
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(errorMessage(err))
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="d-grid gap-3">
        {error && <div className="alert alert-danger py-2 mb-0">{error}</div>}
        <div><label className="form-label" htmlFor="np">New password</label><input id="np" type="password" className="form-control" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><div className="form-text">{PASSWORD_HINT}</div></div>
        <button className="btn btn-primary btn-lg" disabled={busy}>Save password</button>
      </form>
    </AuthLayout>
  )
}
