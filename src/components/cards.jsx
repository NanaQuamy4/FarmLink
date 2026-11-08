import { Link } from 'react-router-dom'
import { Photo, StatusBadge, Avatar } from './ui'
import { PLOT_STATUS, DEAL_STATUS } from '../lib/constants'
import { fmtNumber, displayName } from '../lib/format'

// Select string that brings a plot's first photo along
export const PLOT_SELECT = '*, plot_photos(storage_path, sort_order, is_document)'

export const coverPhoto = (plot) =>
  (plot?.plot_photos || []).filter((p) => !p.is_document).sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path

export function PlotCard({ plot, to, showStatus = true }) {
  return (
    <Link to={to} className="fl-plot-card">
      <div className="overflow-hidden position-relative">
        <Photo path={coverPhoto(plot)} bucket="plot-photos" className="fl-plot-img" style={{ height: 170 }} />
        {showStatus && <span className="position-absolute top-0 start-0 m-2"><StatusBadge map={PLOT_STATUS} value={plot.status} /></span>}
      </div>
      <div className="p-3">
        <div className="fw-semibold text-truncate">{plot.title}</div>
        <div className="small text-muted-fl mb-2"><i className="bi bi-geo-alt me-1" />{[plot.district, plot.region].filter(Boolean).join(', ')}</div>
        <div className="d-flex flex-wrap gap-1">
          <span className="fl-pill" style={{ fontSize: '.72rem', padding: '.15rem .6rem' }}>{fmtNumber(plot.size_acres)} acres</span>
          <span className="fl-pill" style={{ fontSize: '.72rem', padding: '.15rem .6rem' }}>{plot.soil_type}</span>
          <span className="fl-pill" style={{ fontSize: '.72rem', padding: '.15rem .6rem' }}><i className="bi bi-droplet" />{plot.water_access}</span>
        </div>
      </div>
    </Link>
  )
}

// One deal in a list. `me` decides whose name to show as the other party.
export function DealRow({ deal, me }) {
  const other = deal.landowner_id === me ? deal.farmer : deal.landowner
  const done = (deal.season_milestones || []).length
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

export const DEAL_SELECT = `*, plots(title, region, district),
  landowner:profiles!deals_landowner_id_fkey(id, full_name, is_group, group_name, avatar_url),
  farmer:profiles!deals_farmer_id_fkey(id, full_name, is_group, group_name, avatar_url),
  season_milestones(milestone)`
