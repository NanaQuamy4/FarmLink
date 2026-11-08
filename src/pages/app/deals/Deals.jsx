import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState } from '../../../components/ui'
import { DealRow, DEAL_SELECT } from '../../../components/cards'

const GROUPS = { running: ['drafting', 'active', 'harvested'], completed: ['completed'], cancelled: ['cancelled'] }

export default function Deals() {
  const { profile, role } = useAuth()
  const [tab, setTab] = useState('running')
  const { data, loading, error, reload } = useQuery(
    () => supabase.from('deals').select(DEAL_SELECT).order('created_at', { ascending: false }), [profile.id])
  const rows = (data || []).filter((d) => GROUPS[tab].includes(d.status))

  return (
    <div className="fl-page">
      <PageHeader title={role === 'verifier' ? 'Assigned deals' : 'Deals'}
        text={role === 'verifier' ? 'Deals on plots you verified. You can read them to mediate disputes.' : role === 'admin' ? 'All deals on the platform.' : 'Each deal records the agreement, season and harvest split.'} />
      <div className="d-flex gap-2 mb-4">
        {Object.keys(GROUPS).map((k) => (
          <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(k)}>
            {k[0].toUpperCase() + k.slice(1)} <span className="opacity-75">{(data || []).filter((d) => GROUPS[k].includes(d.status)).length}</span>
          </button>
        ))}
      </div>
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="fl-card"><EmptyState icon="bi-file-earmark-check" title="No deals here" text={role === 'farmer' ? 'Apply for a plot. When a landowner accepts, the deal appears here.' : 'Accept an application to start a deal.'} /></div>
      ) : (
        <div className="fl-card p-2">{rows.map((d) => <DealRow key={d.id} deal={d} me={profile.id} />)}</div>
      )}
    </div>
  )
}
