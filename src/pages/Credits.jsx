import { useEffect, useState } from 'react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

// Attribution for Wikimedia Commons photos (required by CC BY / CC BY-SA licences).
export default function Credits() {
  const [credits, setCredits] = useState([])
  useEffect(() => {
    fetch('/images/credits.json').then((r) => r.json()).then(setCredits).catch(() => setCredits([]))
  }, [])

  return (
    <>
      <SiteNav />
      <main className="container fl-section">
        <span className="fl-eyebrow mb-3">Credits</span>
        <h1 className="fl-h-section mb-3">Photo credits</h1>
        <p className="fl-lead mb-5" style={{ maxWidth: 640 }}>
          Photos are from Wikimedia Commons, used under the licences listed. Images were resized for the web.
        </p>
        <div className="row g-4">
          {credits.map((c) => (
            <div className="col-sm-6 col-lg-4" key={c.file}>
              <div className="fl-card p-0 overflow-hidden">
                <img src={c.file} alt={c.title} className="w-100 object-fit-cover" style={{ height: 180 }} loading="lazy" />
                <div className="p-3 small">
                  <div className="fw-semibold">{c.title}</div>
                  <div className="text-muted-fl">{c.author} · {c.license}</div>
                  <a href={c.source} target="_blank" rel="noreferrer">View source</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
