import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useQuery } from '../../../lib/useQuery'
import { PageHeader, Loading, ErrorAlert, EmptyState, Avatar } from '../../../components/ui'
import ChatThread from '../../../components/ChatThread'
import { timeAgo, displayName } from '../../../lib/format'

// Inbox of one-to-one threads (one per application/deal), with the open thread beside it on desktop.
export default function Messages() {
  const { applicationId } = useParams()
  const { profile } = useAuth()
  const { data, loading, error, reload } = useQuery(async () => {
    const [threads, unread] = await Promise.all([
      supabase.from('applications')
        .select(`id, status, plots(title, owner_id, owner:profiles!plots_owner_id_fkey(id, full_name, avatar_url)),
                 farmer:profiles!applications_farmer_id_fkey(id, full_name, is_group, group_name, avatar_url),
                 messages(body, created_at, sender_id)`)
        .order('created_at', { referencedTable: 'messages', ascending: false })
        .limit(1, { referencedTable: 'messages' }),
      supabase.from('messages').select('application_id').not('application_id', 'is', null).is('read_at', null).neq('sender_id', profile.id),
    ])
    if (threads.error) throw threads.error
    const counts = (unread.data || []).reduce((a, m) => ({ ...a, [m.application_id]: (a[m.application_id] || 0) + 1 }), {})
    return (threads.data || [])
      .filter((t) => t.messages.length > 0 || t.status === 'accepted')
      .map((t) => ({ ...t, last: t.messages[0], unread: counts[t.id] || 0, other: t.plots.owner_id === profile.id ? t.farmer : t.plots.owner }))
      .sort((a, b) => new Date(b.last?.created_at || 0) - new Date(a.last?.created_at || 0))
  }, [profile.id, applicationId])

  const current = data?.find((t) => t.id === applicationId)

  const list = (
    <div className="fl-card p-2">
      {(data || []).map((t) => (
        <Link key={t.id} to={`/messages/${t.id}`} className="fl-list-item" style={t.id === applicationId ? { background: 'var(--fl-ground)' } : undefined}>
          <Avatar profile={t.other} size={44} />
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex justify-content-between gap-2"><span className="fw-semibold text-truncate">{displayName(t.other)}</span><span className="small text-muted-fl text-nowrap">{timeAgo(t.last?.created_at)}</span></div>
            <div className="small text-muted-fl text-truncate">{t.plots.title}</div>
            <div className={`small text-truncate ${t.unread ? 'fw-semibold' : 'text-muted-fl'}`}>{t.last ? `${t.last.sender_id === profile.id ? 'You: ' : ''}${t.last.body}` : 'No messages yet'}</div>
          </div>
          {t.unread > 0 && <span className="badge rounded-pill bg-primary">{t.unread}</span>}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="fl-page">
      <PageHeader title="Messages" text="Private conversations with landowners and farmers." />
      <ErrorAlert error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <div className="fl-card"><EmptyState icon="bi-chat-dots" title="No conversations yet" text="Conversations start when a farmer applies for a plot." /></div>
      ) : (
        <div className="row g-4">
          <div className={`col-lg-4 ${applicationId ? 'd-none d-lg-block' : ''}`}>{list}</div>
          <div className={`col-lg-8 ${applicationId ? '' : 'd-none d-lg-block'}`}>
            {current ? (
              <section className="fl-card p-0 overflow-hidden">
                <div className="d-flex align-items-center gap-2 p-3 border-bottom">
                  <Link to="/messages" className="btn btn-light btn-sm d-lg-none" aria-label="Back to inbox"><i className="bi bi-arrow-left" /></Link>
                  <Avatar profile={current.other} size={36} />
                  <div className="flex-grow-1 min-w-0"><div className="fw-semibold text-truncate">{displayName(current.other)}</div><div className="small text-muted-fl text-truncate">{current.plots.title}</div></div>
                  <Link to={`/applications/${current.id}`} className="btn btn-outline-primary btn-sm">Details</Link>
                </div>
                <ChatThread key={current.id} applicationId={current.id} canSend={['pending', 'accepted'].includes(current.status)} height="min(62vh, 560px)" />
              </section>
            ) : (
              <div className="fl-card"><EmptyState icon="bi-chat-left-text" title="Choose a conversation" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
