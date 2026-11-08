import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useQuery } from '../../../lib/useQuery'
import { Loading, ErrorAlert, Avatar } from '../../../components/ui'
import { PlotCard, PLOT_SELECT } from '../../../components/cards'
import { ROLE_LABELS } from '../../../lib/constants'
import { fmtDate, displayName, timeAgo } from '../../../lib/format'

// FR17: public profile with completed seasons, sessions attended and ratings.
export default function PublicProfile() {
  const { id } = useParams()
  const { data, loading, error, reload } = useQuery(async () => {
    const [p, stats, ratings, plots] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.rpc('profile_stats', { p_user: id }),
      supabase.from('ratings').select('*, rater:profiles!ratings_rater_id_fkey(full_name, avatar_url, is_group, group_name)').eq('ratee_id', id).order('created_at', { ascending: false }),
      supabase.from('plots').select(PLOT_SELECT).eq('owner_id', id).eq('status', 'verified'),
    ])
    if (p.error) throw p.error
    return { p: p.data, stats: stats.data || {}, ratings: ratings.data || [], plots: plots.data || [] }
  }, [id])

  if (loading) return <Loading />
  if (error) return <ErrorAlert error={error} onRetry={reload} />
  const { p, stats, ratings, plots } = data

  return (
    <div className="fl-page" style={{ maxWidth: 1000 }}>
      <section className="fl-section-dark fl-on-dark rounded-fl-xl p-4 p-md-5 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-4">
          <Avatar profile={p} size={96} />
          <div className="flex-grow-1">
            <span className="fl-pill lime mb-2">{p.is_group ? `Farmer group · ${p.group_size} members` : ROLE_LABELS[p.role]}</span>
            <h1 className="h2 text-white mb-1">{displayName(p)}</h1>
            <div className="text-white-50">{[p.district, p.region].filter(Boolean).join(', ')}{p.is_group && ` · contact ${p.full_name}`} · on FarmLink since {fmtDate(p.created_at)}</div>
          </div>
        </div>
        {p.bio && <p className="mt-4 mb-0" style={{ maxWidth: 680 }}>{p.bio}</p>}
        <div className="row g-3 mt-2">
          {[['bi-star-fill', stats.rating_average ?? '–', `Rating${stats.rating_count ? ` (${stats.rating_count})` : ''}`], ['bi-trophy', stats.completed_seasons ?? 0, 'Seasons completed'],
            ['bi-camera-video', stats.sessions_attended ?? 0, 'Sessions attended'], ['bi-patch-check', stats.verified_plots ?? 0, 'Verified plots']].map(([icon, v, l]) => (
            <div className="col-6 col-md-3" key={l}><div className="fl-card-dark"><i className={`bi ${icon} text-lime`} /><div className="fl-stat mt-1" style={{ fontSize: '2rem' }}>{v}</div><div className="small">{l}</div></div></div>
          ))}
        </div>
      </section>

      <div className="row g-4">
        <div className={plots.length ? 'col-lg-6' : 'col-12'}>
          <section className="fl-card p-4">
            <h2 className="h5">Ratings</h2>
            {ratings.length === 0 ? <p className="small text-muted-fl mb-0">No ratings yet. Ratings are left after a completed season.</p> : ratings.map((r) => (
              <div key={r.id} className="border-top py-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Avatar profile={r.rater} size={28} /><span className="fw-semibold small">{displayName(r.rater)}</span>
                  <span className="text-ochre ms-auto" aria-label={`${r.score} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={`bi ${n <= r.score ? 'bi-star-fill' : 'bi-star'}`} />)}</span>
                </div>
                {r.comment && <p className="small mb-1">{r.comment}</p>}
                <div className="small text-muted-fl">{timeAgo(r.created_at)}</div>
              </div>
            ))}
          </section>
        </div>
        {plots.length > 0 && (
          <div className="col-lg-6">
            <h2 className="h5">Available plots</h2>
            <div className="d-grid gap-3">{plots.map((pl) => <PlotCard key={pl.id} plot={pl} to={`/find/${pl.id}`} showStatus={false} />)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
