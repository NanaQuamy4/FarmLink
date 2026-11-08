import { Link } from 'react-router-dom'

// Logo lockup built in markup so the Outfit wordmark stays crisp (see brand README).
export default function Brand({ reverse = false, to = '/' }) {
  return (
    <Link to={to} className={`fl-brand${reverse ? ' reverse' : ''}`} aria-label="FarmLink home">
      <img src={reverse ? '/brand/mark-reverse.svg' : '/brand/mark.svg'} alt="" width="36" height="36" />
      <span className="fl-brand-name">Farm<span>Link</span></span>
    </Link>
  )
}
