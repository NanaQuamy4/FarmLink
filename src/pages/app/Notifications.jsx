import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, ActionButton } from '../../components/ui'
import { notificationIcon } from '../../app/NotificationBell'
import { timeAgo } from '../../lib/format'

export default function Notifications() {
  const { data, loading, error, reload, setData } = useQuery(
    () => supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100), [])

  async function markAll() {
    await supabase.rpc('mark_all_notifications_read')
    setData((data || []).map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
  }
  async function markOne(n) {
    if (n.read_at) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
  }

  return (
    <div className="fl-page">
      <PageHeader title="Notifications" text="Applications, messages, verification, milestones and disputes."
        actions={data?.some((n) => !n.read_at) && <ActionButton className="btn btn-outline-primary" onClick={markAll}>Mark all as read</ActionButton>} />
      <ErrorAlert error={error} onRetry={reload} />
      {loading ? <Loading /> : !data?.length ? (
        <div className="fl-card"><EmptyState icon="bi-bell" title="No notifications yet" text="You will be notified here when something needs your attention." /></div>
      ) : (
        <div className="fl-card p-2">
          {data.map((n) => (
            <Link key={n.id} to={n.link || '#'} onClick={() => markOne(n)} className="fl-list-item" style={!n.read_at ? { background: '#F5FAEC' } : undefined}>
              <span className="fl-icon-tile soft flex-none"><i className={`bi ${notificationIcon(n.type)}`} /></span>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold">{n.title}</div>
                {n.body && <div className="small text-muted-fl">{n.body}</div>}
              </div>
              <span className="small text-muted-fl text-nowrap">{timeAgo(n.created_at)}</span>
              {!n.read_at && <span className="fl-unread-dot" aria-label="unread" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
