import { useEffect, useState } from 'react'
import { supabase, errorMessage } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PageHeader, Avatar, Field } from '../../components/ui'
import { REGIONS, ROLE_LABELS } from '../../lib/constants'
import { compressImage } from '../../lib/storage'

export default function Profile() {
  const { profile, refreshProfile, role } = useAuth()
  const [form, setForm] = useState({ ...profile })
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [verifier, setVerifier] = useState(null)
  const [req, setReq] = useState({ type: 'community', organisation: '', regions: profile.region ? [profile.region] : [] })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  useEffect(() => {
    supabase.from('profile_contacts').select('phone').eq('user_id', profile.id).maybeSingle().then(({ data }) => setPhone(data?.phone || ''))
    supabase.from('verifiers').select('*').eq('id', profile.id).maybeSingle().then(({ data }) => setVerifier(data))
  }, [profile.id])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMsg({})
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name, region: form.region || null, district: form.district || null, bio: form.bio || null,
        is_group: role === 'farmer' && form.is_group,
        group_name: role === 'farmer' && form.is_group ? form.group_name : null,
        group_size: role === 'farmer' && form.is_group ? Number(form.group_size) || null : null,
      }).eq('id', profile.id)
      if (error) throw error
      const r = await supabase.from('profile_contacts').update({ phone: phone || null }).eq('user_id', profile.id)
      if (r.error) throw r.error
      await refreshProfile()
      setMsg({ type: 'success', text: 'Profile saved.' })
    } catch (err) {
      setMsg({ type: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  async function uploadAvatar(file) {
    if (!file) return
    try {
      const small = await compressImage(file, 400)
      const path = `${profile.id}/avatar-${Date.now()}.jpg`
      const up = await supabase.storage.from('avatars').upload(path, small, { upsert: true, contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
    } catch (err) {
      setMsg({ type: 'danger', text: errorMessage(err) })
    }
  }

  async function requestVerifier(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('request_verifier_role', { p_type: req.type, p_organisation: req.organisation, p_regions: req.regions })
    if (error) return setMsg({ type: 'danger', text: errorMessage(error) })
    const { data } = await supabase.from('verifiers').select('*').eq('id', profile.id).maybeSingle()
    setVerifier(data)
    setMsg({ type: 'success', text: 'Request sent. An administrator will review it.' })
  }

  return (
    <div className="fl-page" style={{ maxWidth: 820 }}>
      <PageHeader title="Profile & settings" text={`${ROLE_LABELS[role]} account`} />
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <form className="fl-card p-4 mb-4" onSubmit={save}>
        <div className="d-flex align-items-center gap-3 mb-4">
          <Avatar profile={profile} size={72} />
          <div>
            <label className="btn btn-outline-primary btn-sm mb-0">
              <i className="bi bi-camera me-1" />Change photo
              <input type="file" accept="image/*" hidden onChange={(e) => uploadAvatar(e.target.files[0])} />
            </label>
            <div className="small text-muted-fl mt-1">Shown on your public profile and in chats.</div>
          </div>
        </div>
        <div className="row g-3">
          <Field className="col-md-6" label="Full name" htmlFor="p-name"><input id="p-name" className="form-control" value={form.full_name || ''} onChange={set('full_name')} required /></Field>
          <Field className="col-md-6" label="Phone" htmlFor="p-phone" hint="Only shared with your deal partners, verifiers and admins."><input id="p-phone" type="tel" className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field className="col-md-6" label="Region" htmlFor="p-region">
            <select id="p-region" className="form-select" value={form.region || ''} onChange={set('region')}>
              <option value="">Choose…</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field className="col-md-6" label="District" htmlFor="p-district"><input id="p-district" className="form-control" value={form.district || ''} onChange={set('district')} /></Field>
          <Field className="col-12" label="About you" htmlFor="p-bio" hint="Experience, crops you grow, what you are looking for."><textarea id="p-bio" className="form-control" rows={3} maxLength={1000} value={form.bio || ''} onChange={set('bio')} /></Field>
          {role === 'farmer' && (
            <>
              <div className="col-12 form-check form-switch ms-2">
                <input className="form-check-input" type="checkbox" id="p-group" checked={!!form.is_group} onChange={set('is_group')} />
                <label className="form-check-label" htmlFor="p-group">This account is a farmer group</label>
              </div>
              {form.is_group && (
                <>
                  <Field className="col-md-8" label="Group name" htmlFor="p-gname"><input id="p-gname" className="form-control" value={form.group_name || ''} onChange={set('group_name')} required /></Field>
                  <Field className="col-md-4" label="Members" htmlFor="p-gsize"><input id="p-gsize" type="number" min="2" className="form-control" value={form.group_size || ''} onChange={set('group_size')} required /></Field>
                </>
              )}
            </>
          )}
        </div>
        <button className="btn btn-primary mt-4" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save changes</button>
      </form>

      {['farmer', 'landowner'].includes(role) && (
        <section className="fl-card p-4">
          <h2 className="h5">Become a verifier</h2>
          {verifier ? (
            <p className="mb-0 text-muted-fl">
              {verifier.approved ? 'Your verifier access is approved.' : verifier.approved_at ? 'Your last request was not approved.' : `Request sent for ${verifier.regions.join(', ')}. An administrator will review it.`}
            </p>
          ) : (
            <form onSubmit={requestVerifier} className="row g-3">
              <p className="text-muted-fl mb-0">Extension officers and community leaders (farmer association leaders, assembly members) can check plots and mediate disputes once an administrator approves them.</p>
              <Field className="col-md-6" label="I am" htmlFor="v-type">
                <select id="v-type" className="form-select" value={req.type} onChange={(e) => setReq({ ...req, type: e.target.value })}>
                  <option value="extension_officer">An extension officer</option>
                  <option value="community">A community leader</option>
                </select>
              </Field>
              <Field className="col-md-6" label="Organisation" htmlFor="v-org"><input id="v-org" className="form-control" value={req.organisation} onChange={(e) => setReq({ ...req, organisation: e.target.value })} placeholder="e.g. District agriculture office" /></Field>
              <Field className="col-12" label="Regions you can cover" htmlFor="v-regions">
                <select id="v-regions" className="form-select" multiple size={5} value={req.regions} onChange={(e) => setReq({ ...req, regions: [...e.target.selectedOptions].map((o) => o.value) })}>
                  {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <div className="col-12"><button className="btn btn-outline-primary" disabled={!req.regions.length}>Send request</button></div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
