import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorMessage } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, StatusBadge, Avatar, ActionButton } from '../../../components/ui'
import { ROLE_LABELS, REGIONS, PLOT_STATUS, DEAL_STATUS, DISPUTE_STATUS, DISPUTE_CATEGORIES } from '../../../lib/constants'
import { fmtDate, fmtNumber, displayName, timeAgo } from '../../../lib/format'
import { exportPdf, exportExcel } from '../../../lib/exportReport'
import { BarList, MonthChart } from './AdminOverview'

// ---------- Users ----------
export function AdminUsers() {
  const { profile: me } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [err, setErr] = useState('')
  const { data, loading, error, reload, setData } = useQuery(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }), [])
  const rows = (data || []).filter((p) => (!role || p.role === role) && (!q || [p.full_name, p.group_name, p.region, p.district].join(' ').toLowerCase().includes(q.toLowerCase())))

  async function changeRole(p, r) {
    setErr('')
    const { error: e } = await supabase.rpc('set_user_role', { p_user: p.id, p_role: r })
    if (e) return setErr(errorMessage(e))
    setData(data.map((x) => (x.id === p.id ? { ...x, role: r } : x)))
  }
  async function toggleHost(p) {
    setErr('')
    const { error: e } = await supabase.rpc('set_session_host', { p_user: p.id, p_allowed: !p.can_host_sessions })
    if (e) return setErr(errorMessage(e))
    setData(data.map((x) => (x.id === p.id ? { ...x, can_host_sessions: !p.can_host_sessions } : x)))
  }
  async function suspend(p) {
    setErr('')
    const { error: e } = await supabase.rpc('set_user_suspended', { p_user: p.id, p_suspended: !p.is_suspended })
    if (e) return setErr(errorMessage(e))
    setData(data.map((x) => (x.id === p.id ? { ...x, is_suspended: !p.is_suspended } : x)))
  }

  return (
    <div className="fl-page">
      <PageHeader eyebrow="Admin" title="Users" text={`${data?.length ?? '…'} accounts. Make verifiers through the Verifiers page so their regions are set. Switch on "Hosts sessions" for experts who should run education sessions.`} />
      <div className="fl-card p-3 mb-3 d-flex flex-wrap gap-2">
        <input className="form-control" style={{ maxWidth: 320 }} placeholder="Search name, group, region…" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-select w-auto" aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <ErrorAlert error={err || error} onRetry={error ? reload : undefined} />
      {loading ? <Loading /> : (
        <div className="fl-card p-0 table-responsive">
          <table className="table align-middle mb-0">
            <thead className="small text-muted-fl"><tr><th className="ps-3">User</th><th>Region</th><th>Joined</th><th>Role</th><th title="Can schedule education sessions">Hosts sessions</th><th className="text-end pe-3">Account</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.is_suspended ? 'opacity-50' : ''}>
                  <td className="ps-3"><Link to={`/u/${p.id}`} className="d-flex align-items-center gap-2 text-reset text-decoration-none"><Avatar profile={p} size={34} /><span><span className="fw-semibold d-block">{displayName(p)}</span>{p.is_group && <span className="small text-muted-fl">{p.full_name} · group of {p.group_size}</span>}</span></Link></td>
                  <td className="small">{p.region || '–'}</td>
                  <td className="small text-nowrap">{fmtDate(p.created_at)}</td>
                  <td>
                    <select className="form-select form-select-sm w-auto" aria-label={`Role for ${displayName(p)}`} value={p.role} disabled={p.id === me.id} onChange={(e) => changeRole(p, e.target.value)}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    {['verifier', 'admin'].includes(p.role) ? <span className="small text-muted-fl">Always</span> : (
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input" type="checkbox" role="switch" aria-label={`Let ${displayName(p)} host sessions`} checked={!!p.can_host_sessions} onChange={() => toggleHost(p)} />
                      </div>
                    )}
                  </td>
                  <td className="text-end pe-3">
                    {p.id !== me.id && <ActionButton className={`btn btn-sm ${p.is_suspended ? 'btn-outline-primary' : 'btn-outline-danger'}`} confirm={p.is_suspended ? null : `Suspend ${displayName(p)}?`} onClick={() => suspend(p)}>{p.is_suspended ? 'Reactivate' : 'Suspend'}</ActionButton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon="bi-people" title="No users match" />}
        </div>
      )}
    </div>
  )
}

// ---------- Verifiers ----------
export function AdminVerifiers() {
  const [err, setErr] = useState('')
  const [regions, setRegions] = useState({})
  const { data, loading, error, reload } = useQuery(() => supabase.from('verifiers')
    .select('*, profile:profiles!verifiers_id_fkey(id, full_name, region, role, is_suspended, avatar_url)').order('created_at', { ascending: false }), [])
  const pending = (data || []).filter((v) => !v.approved && !v.approved_at)
  const approved = (data || []).filter((v) => v.approved)

  async function decide(v, approve) {
    setErr('')
    const { error: e } = await supabase.rpc('approve_verifier', { p_user: v.id, p_approve: approve, p_regions: regions[v.id] || v.regions })
    if (e) return setErr(errorMessage(e))
    reload()
  }

  const RegionPicker = ({ v }) => (
    <select multiple size={4} className="form-select form-select-sm" aria-label="Regions" value={regions[v.id] || v.regions}
      onChange={(e) => setRegions({ ...regions, [v.id]: [...e.target.selectedOptions].map((o) => o.value) })}>
      {REGIONS.map((r) => <option key={r}>{r}</option>)}
    </select>
  )

  return (
    <div className="fl-page">
      <PageHeader eyebrow="Admin" title="Verifiers" text="Extension officers and approved community verifiers check plots and mediate disputes in their regions." />
      <ErrorAlert error={err || error} onRetry={error ? reload : undefined} />
      {loading ? <Loading /> : (
        <div className="d-grid gap-4">
          <section>
            <h2 className="h5">Requests waiting <span className="text-muted-fl fw-normal">({pending.length})</span></h2>
            {pending.length === 0 ? <div className="fl-card p-4 text-muted-fl small">No requests.</div> : pending.map((v) => (
              <div key={v.id} className="fl-card p-4 mb-3">
                <div className="row g-3 align-items-start">
                  <div className="col-md-5 d-flex gap-3">
                    <Avatar profile={v.profile} size={44} />
                    <div><div className="fw-semibold">{v.profile.full_name}</div><div className="small text-muted-fl">{v.verifier_type === 'extension_officer' ? 'Extension officer' : 'Community verifier'} · {v.organisation || 'No organisation given'}</div><div className="small text-muted-fl">Requested {timeAgo(v.created_at)}</div></div>
                  </div>
                  <div className="col-md-4"><div className="small fw-semibold mb-1">Regions</div><RegionPicker v={v} /></div>
                  <div className="col-md-3 d-grid gap-2">
                    <ActionButton className="btn btn-primary" onClick={() => decide(v, true)}>Approve</ActionButton>
                    <ActionButton className="btn btn-outline-danger" confirm="Decline this request?" onClick={() => decide(v, false)}>Decline</ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </section>
          <section>
            <h2 className="h5">Active verifiers <span className="text-muted-fl fw-normal">({approved.length})</span></h2>
            <div className="fl-card p-2">
              {approved.length === 0 && <p className="text-muted-fl small p-3 mb-0">None yet.</p>}
              {approved.map((v) => (
                <div key={v.id} className="fl-list-item">
                  <Avatar profile={v.profile} size={40} />
                  <div className="flex-grow-1 min-w-0"><div className="fw-semibold">{v.profile.full_name}</div><div className="small text-muted-fl">{v.verifier_type === 'extension_officer' ? 'Extension officer' : 'Community verifier'} · {v.organisation}</div></div>
                  <div className="d-none d-md-flex flex-wrap gap-1 justify-content-end" style={{ maxWidth: 320 }}>{v.regions.map((r) => <span key={r} className="fl-pill" style={{ fontSize: '.72rem', padding: '.1rem .55rem' }}>{r}</span>)}</div>
                  <ActionButton className="btn btn-sm btn-outline-danger" confirm={`Remove verifier access for ${v.profile.full_name}?`} onClick={() => decide(v, false)}>Remove</ActionButton>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// ---------- Plots ----------
export function AdminPlots() {
  const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useQuery(() => supabase.from('plots')
    .select('*, owner:profiles!plots_owner_id_fkey(full_name), verifier:profiles!plots_assigned_verifier_id_fkey(full_name)').order('created_at', { ascending: false }), [])
  const rows = (data || []).filter((p) => !status || p.status === status)
  return (
    <div className="fl-page">
      <PageHeader eyebrow="Admin" title="Plots" text="All listings. Admins can verify plots in regions with no verifier." />
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button type="button" className={`btn btn-sm ${!status ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setStatus('')}>All</button>
        {Object.entries(PLOT_STATUS).map(([k, [l]]) => <button key={k} type="button" className={`btn btn-sm ${status === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <div className="fl-card p-0 table-responsive">
          <table className="table align-middle mb-0">
            <thead className="small text-muted-fl"><tr><th className="ps-3">Plot</th><th>Owner</th><th>Region</th><th>Acres</th><th>Verifier</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="ps-3 fw-semibold"><Link to={`/plots/${p.id}`} className="text-reset">{p.title}</Link></td>
                  <td className="small">{p.owner?.full_name}</td>
                  <td className="small">{p.region}</td>
                  <td className="small">{fmtNumber(p.size_acres)}</td>
                  <td className="small">{p.verifier?.full_name || <span className="text-danger">None</span>}</td>
                  <td><StatusBadge map={PLOT_STATUS} value={p.status} /></td>
                  <td className="pe-3 text-end">{p.status === 'pending' && <Link to={`/verify/plots/${p.id}`} className="btn btn-sm btn-primary">Verify</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon="bi-geo-alt" title="No plots" />}
        </div>
      )}
    </div>
  )
}

// ---------- Reports (FR11) ----------
const REPORTS = {
  users: {
    title: 'Users',
    columns: [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'region', label: 'Region' }, { key: 'group', label: 'Group size' }, { key: 'joined', label: 'Joined' }, { key: 'status', label: 'Status' }],
    load: async () => (await supabase.from('profiles').select('*').order('created_at')).data.map((p) => ({
      name: displayName(p), role: ROLE_LABELS[p.role], region: p.region || '', group: p.is_group ? p.group_size : '', joined: fmtDate(p.created_at), status: p.is_suspended ? 'Suspended' : 'Active' })),
  },
  plots: {
    title: 'Plots',
    columns: [{ key: 'title', label: 'Plot' }, { key: 'owner', label: 'Owner' }, { key: 'region', label: 'Region' }, { key: 'district', label: 'District' }, { key: 'acres', label: 'Acres' }, { key: 'soil', label: 'Soil' }, { key: 'water', label: 'Water' }, { key: 'status', label: 'Status' }, { key: 'listed', label: 'Listed' }],
    load: async () => (await supabase.from('plots').select('*, owner:profiles!plots_owner_id_fkey(full_name)').order('created_at')).data.map((p) => ({
      title: p.title, owner: p.owner?.full_name, region: p.region, district: p.district || '', acres: Number(p.size_acres), soil: p.soil_type, water: p.water_access, status: PLOT_STATUS[p.status][0], listed: fmtDate(p.created_at) })),
  },
  deals: {
    title: 'Deals',
    columns: [{ key: 'plot', label: 'Plot' }, { key: 'landowner', label: 'Landowner' }, { key: 'farmer', label: 'Farmer' }, { key: 'status', label: 'Status' }, { key: 'started', label: 'Started' }, { key: 'completed', label: 'Completed' }],
    load: async () => (await supabase.from('deals').select('*, plots(title), landowner:profiles!deals_landowner_id_fkey(full_name), farmer:profiles!deals_farmer_id_fkey(full_name, is_group, group_name)').order('created_at')).data.map((d) => ({
      plot: d.plots?.title, landowner: d.landowner?.full_name, farmer: displayName(d.farmer), status: DEAL_STATUS[d.status][0], started: d.started_at ? fmtDate(d.started_at) : '', completed: d.completed_at ? fmtDate(d.completed_at) : '' })),
  },
  harvests: {
    title: 'Harvests',
    columns: [{ key: 'plot', label: 'Plot' }, { key: 'total', label: 'Total' }, { key: 'unit', label: 'Unit' }, { key: 'landowner', label: 'Landowner share' }, { key: 'farmer', label: 'Farmer share' }, { key: 'lv', label: 'Landowner GH₵' }, { key: 'fv', label: 'Farmer GH₵' }, { key: 'date', label: 'Recorded' }],
    load: async () => (await supabase.from('harvest_records').select('*, deals(plots(title))').order('created_at')).data.map((h) => ({
      plot: h.deals?.plots?.title, total: Number(h.total_quantity), unit: h.unit, landowner: Number(h.landowner_share), farmer: Number(h.farmer_share), lv: h.landowner_value ?? '', fv: h.farmer_value ?? '', date: fmtDate(h.created_at) })),
  },
  disputes: {
    title: 'Disputes',
    columns: [{ key: 'plot', label: 'Plot' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status' }, { key: 'verifier', label: 'Verifier' }, { key: 'raised', label: 'Raised' }, { key: 'resolved', label: 'Resolved' }, { key: 'outcome', label: 'Outcome' }],
    load: async () => (await supabase.from('disputes').select('*, deals(plots(title)), verifier:profiles!disputes_verifier_id_fkey(full_name)').order('created_at')).data.map((d) => ({
      plot: d.deals?.plots?.title, category: DISPUTE_CATEGORIES[d.category], status: DISPUTE_STATUS[d.status][0], verifier: d.verifier?.full_name || '', raised: fmtDate(d.created_at), resolved: d.resolved_at ? fmtDate(d.resolved_at) : '', outcome: d.resolution || '' })),
  },
}

export function AdminReports() {
  const [which, setWhich] = useState('plots')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const stats = useQuery(() => supabase.rpc('admin_stats'), [])
  const report = useQuery(() => REPORTS[which].load(), [which])
  const current = useMemo(() => ({ ...REPORTS[which], rows: report.data || [] }), [which, report.data])

  async function run(kind, all) {
    setBusy(kind + (all ? '-all' : ''))
    setErr('')
    try {
      const reports = all ? await Promise.all(Object.values(REPORTS).map(async (r) => ({ ...r, rows: await r.load() }))) : [current]
      const title = all ? 'Platform report' : `${current.title} report`
      if (kind === 'pdf') await exportPdf(reports, title)
      else await exportExcel(reports, title)
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="fl-page">
      <PageHeader eyebrow="Admin" title="Reports" text="Users, plots, deals, harvests and disputes. Export to PDF or Excel."
        actions={<>
          <ActionButton className="btn btn-outline-primary" onClick={() => run('pdf', true)}><i className="bi bi-file-earmark-pdf me-1" />Full report PDF</ActionButton>
          <ActionButton className="btn btn-primary" onClick={() => run('xlsx', true)}><i className="bi bi-file-earmark-excel me-1" />Full report Excel</ActionButton>
        </>} />
      <ErrorAlert error={err} />
      {stats.data && (
        <div className="row g-4 mb-4">
          <div className="col-lg-8"><section className="fl-card p-4 h-100"><h2 className="h6 mb-3">Deals started per month</h2><MonthChart rows={stats.data.deals_per_month} /></section></div>
          <div className="col-lg-4"><section className="fl-card p-4 h-100"><h2 className="h6 mb-3">Disputes</h2><BarList data={stats.data.disputes_by_status} labels={DISPUTE_STATUS} /></section></div>
        </div>
      )}
      <div className="fl-card p-3">
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <div className="d-flex flex-wrap gap-2">
            {Object.entries(REPORTS).map(([k, r]) => <button key={k} type="button" className={`btn btn-sm ${which === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setWhich(k)}>{r.title}</button>)}
          </div>
          <div className="d-flex gap-2">
            <ActionButton className="btn btn-sm btn-outline-primary" disabled={!current.rows.length} onClick={() => run('pdf')}><i className="bi bi-file-earmark-pdf me-1" />PDF</ActionButton>
            <ActionButton className="btn btn-sm btn-outline-primary" disabled={!current.rows.length} onClick={() => run('xlsx')}><i className="bi bi-file-earmark-excel me-1" />Excel</ActionButton>
          </div>
        </div>
        <ErrorAlert error={report.error} onRetry={report.reload} />
        {report.loading ? <Loading /> : current.rows.length === 0 ? <EmptyState icon="bi-table" title="No rows" /> : (
          <div className="table-responsive">
            <table className="table table-sm small align-middle mb-0">
              <thead><tr>{current.columns.map((c) => <th key={c.key} className="text-muted-fl text-nowrap">{c.label}</th>)}</tr></thead>
              <tbody>{current.rows.map((r, i) => <tr key={i}>{current.columns.map((c) => <td key={c.key}>{String(r[c.key] ?? '')}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {busy && <div className="small text-muted-fl mt-2">Preparing export…</div>}
    </div>
  )
}
