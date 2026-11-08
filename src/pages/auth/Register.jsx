import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { supabase, errorMessage } from '../../lib/supabase'
import { REGIONS } from '../../lib/constants'
import { passwordProblem, PASSWORD_HINT } from '../../lib/format'

const ROLES = [
  { key: 'landowner', icon: 'bi-house-door', title: 'Landowner', text: 'I have land to list' },
  { key: 'farmer', icon: 'bi-person-workspace', title: 'Farmer', text: 'I want land to farm' },
  { key: 'buyer', icon: 'bi-basket', title: 'Buyer', text: 'I want to buy produce' },
]

export default function Register() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState(ROLES.some((r) => r.key === params.get('role')) ? params.get('role') : 'farmer')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', region: '', password: '', is_group: false, group_name: '', group_size: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (passwordProblem(form.password)) return setError(passwordProblem(form.password))
    if (form.phone && !/^\+?[0-9 ]{9,16}$/.test(form.phone)) return setError('Enter a phone number like 024 123 4567.')
    if (role === 'farmer' && form.is_group && (!form.group_name || Number(form.group_size) < 2)) return setError('Add your group name and how many members it has (2 or more).')
    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          role,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          region: form.region,
          is_group: role === 'farmer' && form.is_group,
          group_name: form.group_name.trim(),
          group_size: form.group_size,
        },
      },
    })
    setBusy(false)
    if (err) return setError(errorMessage(err))
    if (data.session) navigate('/dashboard', { replace: true })
    else setSent(true) // email confirmation is switched on in Supabase
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${form.email}. Open it to finish creating your account.`}>
        <Link to="/login" className="btn btn-primary">Back to log in</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Free for landowners, farmers and buyers." image="/images/auth-tea-garden.webp">
      <form onSubmit={submit} className="d-grid gap-3" noValidate>
        {error && <div className="alert alert-danger py-2 mb-0" role="alert">{error}</div>}
        <fieldset>
          <legend className="form-label fs-6">I am a…</legend>
          <div className="row g-2">
            {ROLES.map((r) => (
              <div className="col-4" key={r.key}>
                <input type="radio" className="btn-check" name="role" id={`role-${r.key}`} checked={role === r.key} onChange={() => setRole(r.key)} />
                <label className="btn btn-outline-primary w-100 h-100 d-grid gap-1 py-3 px-1 fl-role-option" htmlFor={`role-${r.key}`}>
                  <i className={`bi ${r.icon} fs-4`} />
                  <span className="fw-semibold fl-role-title">{r.title}</span>
                  <span className="small fw-normal d-none d-sm-block" style={{ opacity: 0.8 }}>{r.text}</span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        {role === 'farmer' && (
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" role="switch" id="is_group" checked={form.is_group} onChange={set('is_group')} />
            <label className="form-check-label" htmlFor="is_group">We are a farmer group applying together</label>
          </div>
        )}
        {role === 'farmer' && form.is_group && (
          <div className="row g-2">
            <div className="col-8"><label className="form-label" htmlFor="group_name">Group name</label><input id="group_name" className="form-control" value={form.group_name} onChange={set('group_name')} /></div>
            <div className="col-4"><label className="form-label" htmlFor="group_size">Members</label><input id="group_size" type="number" min="2" className="form-control" value={form.group_size} onChange={set('group_size')} /></div>
          </div>
        )}

        <div>
          <label className="form-label" htmlFor="full_name">{role === 'farmer' && form.is_group ? 'Contact person' : 'Full name'}</label>
          <input id="full_name" className="form-control" autoComplete="name" required value={form.full_name} onChange={set('full_name')} />
        </div>
        <div className="row g-2">
          <div className="col-sm-6"><label className="form-label" htmlFor="phone">Phone</label><input id="phone" type="tel" className="form-control" autoComplete="tel" placeholder="024 123 4567" value={form.phone} onChange={set('phone')} /></div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="region">Region</label>
            <select id="region" className="form-select" value={form.region} onChange={set('region')}>
              <option value="">Choose…</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div><label className="form-label" htmlFor="reg-email">Email</label><input id="reg-email" type="email" className="form-control" autoComplete="email" required value={form.email} onChange={set('email')} /></div>
        <div>
          <label className="form-label" htmlFor="reg-password">Password</label>
          <input id="reg-password" type="password" className="form-control" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
          <div className="form-text">{PASSWORD_HINT}</div>
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !form.full_name || !form.email || !form.password}>
          {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}Create account
        </button>
        <p className="small text-muted-fl mb-0">
          Verifiers are approved by an administrator. Create a farmer or landowner account first, then request verifier access from your profile.
        </p>
        <p className="text-center text-muted-fl mb-0">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </AuthLayout>
  )
}
