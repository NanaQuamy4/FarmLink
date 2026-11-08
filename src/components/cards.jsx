import { Link } from 'react-router-dom'
import { Photo, StatusBadge, Avatar } from './ui'
import { PLOT_STATUS, DEAL_STATUS, MILESTONES } from '../lib/constants'
import { fmtNumber, displayName } from '../lib/format'

// Select string that brings a plot's first photo along
export const PLOT_SELECT = '*, plot_photos(storage_path, sort_order, is_document)'

export const coverPhoto = (plot) =>
  (plot?.plot_photos || []).filter((p) => !p.is_document).sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path

// Photo card with the details over a gradient and a lime arrow (landing page style)
export function PlotCard({ plot, to, showStatus = true, height = 300 }) {
  return (
    <Link to={to} className="fl-img-card fl-photo-card" style={{ minHeight: height }}>
      <Photo path={coverPhoto(plot)} bucket="plot-photos" alt="" className="fl-photo-fill" size="sm" />
      {showStatus && <span className="position-absolute top-0 start-0 m-3"><StatusBadge map={PLOT_STATUS} value={plot.status} /></span>}
      <span className="fl-card-arrow" aria-hidden="true"><i className="bi bi-arrow-up-right" /></span>
      <div className="fl-img-card-body pe-5">
        <h3 className="h5 mb-1 text-truncate">{plot.title}</h3>
        <div className="small mb-2" style={{ opacity: 0.85 }}><i className="bi bi-geo-alt me-1" />{[plot.district, plot.region].filter(Boolean).join(', ')}</div>
        <div className="d-flex flex-wrap gap-1">
          <span className="fl-pill glass">{fmtNumber(plot.size_acres)} acres</span>
          <span className="fl-pill glass">{plot.soil_type}</span>
          <span className="fl-pill glass"><i className="bi bi-droplet" />{plot.water_access}</span>
        </div>
      </div>
    </Link>
  )
}

// One deal in a list. `me` decides whose name to show as the other party.
export function DealRow({ deal, me }) {
  const other = deal.landowner_id === me ? deal.farmer : deal.landowner
  const done = new Set((deal.season_milestones || []).map((m) => m.milestone)).size
  return (
    <Link to={`/deals/${deal.id}`} className="fl-list-item">
      <Avatar profile={other} size={42} />
      <div className="flex-grow-1 min-w-0">
        <div className="fw-semibold text-truncate">{deal.plots?.title}</div>
        <div className="small text-muted-fl text-truncate">with {displayName(other)}</div>
        {deal.status === 'active' && (
          <div className="fl-progress-steps mt-2" aria-label={`${done} of 4 milestones`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={i < done ? 'done' : ''} />)}
          </div>
        )}
      </div>
      <StatusBadge map={DEAL_STATUS} value={deal.status} />
    </Link>
  )
}

// Deal as a card with the plot photo and the season steps
export function DealCard({ deal, me }) {
  const other = deal.landowner_id === me ? deal.farmer : deal.landowner
  const done = new Set((deal.season_milestones || []).map((m) => m.milestone))
  return (
    <Link to={`/deals/${deal.id}`} className="fl-deal-card fl-lift">
      <div className="fl-deal-card-img">
        <Photo path={coverPhoto(deal.plots)} bucket="plot-photos" alt="" className="fl-cover" size="sm" />
        <span className="position-absolute top-0 start-0 m-2"><StatusBadge map={DEAL_STATUS} value={deal.status} /></span>
      </div>
      <div className="p-3 flex-grow-1 d-flex flex-column">
        <div className="fw-semibold text-truncate">{deal.plots?.title}</div>
        <div className="d-flex align-items-center gap-2 small text-muted-fl mt-1 mb-3">
          <Avatar profile={other} size={22} /><span className="text-truncate">with {displayName(other)}</span>
        </div>
        <div className="d-flex gap-1 mt-auto">
          {MILESTONES.map((m) => (
            <div key={m.key} className="flex-grow-1 text-center">
              <div className={`fl-step-dot ${done.has(m.key) ? 'done' : ''}`}><i className={`bi ${done.has(m.key) ? 'bi-check-lg' : m.icon}`} /></div>
              <div className="small mt-1" style={{ fontSize: '.7rem' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}

export const DEAL_SELECT = `*, plots(title, region, district, plot_photos(storage_path, sort_order, is_document)),
  landowner:profiles!deals_landowner_id_fkey(id, full_name, is_group, group_name, avatar_url),
  farmer:profiles!deals_farmer_id_fkey(id, full_name, is_group, group_name, avatar_url),
  season_milestones(milestone), agreements(deal_id, version, landowner_confirmed_at, farmer_confirmed_at)`
