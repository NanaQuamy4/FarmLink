import { Link } from 'react-router-dom'
import Brand from './Brand'

export default function SiteFooter() {
  return (
    <footer className="fl-on-dark text-white-50 pt-5 pb-4 mt-5" style={{ background: 'var(--fl-deep-3)' }}>
      <div className="container">
        <div className="row g-4 pb-4 border-bottom border-white border-opacity-10">
          <div className="col-lg-4">
            <Brand reverse />
            <p className="mt-3 mb-0 small" style={{ maxWidth: 320 }}>
              Connecting idle farmland with young farmers, and keeping a clear record of every partnership from
              agreement to harvest.
            </p>
          </div>
          <div className="col-6 col-lg-2">
            <h6 className="text-white mb-3">Platform</h6>
            <ul className="list-unstyled small d-grid gap-2">
              <li><a className="link-light link-opacity-75 text-decoration-none" href="/#how-it-works">How it works</a></li>
              <li><a className="link-light link-opacity-75 text-decoration-none" href="/#calculator">Harvest split</a></li>
              <li><Link className="link-light link-opacity-75 text-decoration-none" to="/register">Create account</Link></li>
            </ul>
          </div>
          <div className="col-6 col-lg-2">
            <h6 className="text-white mb-3">For you</h6>
            <ul className="list-unstyled small d-grid gap-2">
              <li><a className="link-light link-opacity-75 text-decoration-none" href="/#landowners">Landowners</a></li>
              <li><a className="link-light link-opacity-75 text-decoration-none" href="/#farmers">Farmers</a></li>
              <li><a className="link-light link-opacity-75 text-decoration-none" href="/#faq">Verifiers</a></li>
            </ul>
          </div>
          <div className="col-lg-4">
            <h6 className="text-white mb-3">Good to know</h6>
            <p className="small mb-0">
              FarmLink agreements record what both parties confirmed. They are not legal contracts, and plot
              verification is not proof of land title.
            </p>
          </div>
        </div>
        <div className="d-flex flex-column flex-md-row justify-content-between gap-2 pt-4 small">
          <span>© {new Date().getFullYear()} FarmLink. Diploma in IT final year project.</span>
          <Link className="link-light link-opacity-75 text-decoration-none" to="/credits">Photo credits</Link>
        </div>
      </div>
    </footer>
  )
}
