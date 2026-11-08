import { useMemo, useState } from 'react'

// Education sessions (FR13) and session notes / recordings (FR14).
// Session dates are relative to today so the demo always shows upcoming sessions.

const daysFromNow = (d, hour) => {
  const t = new Date()
  t.setDate(t.getDate() + d)
  t.setHours(hour, 0, 0, 0)
  return t
}
const fmtDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const upcoming = [
  { id: 1, topic: 'Controlling fall armyworm in maize', host: 'Extension officer · Bono East', in: 3, hour: 10, seats: 60, taken: 41, tag: 'Maize', img: '/images/maize-field.jpg' },
  { id: 2, topic: 'Dry-season vegetables with drip irrigation', host: 'Agronomist · Volta', in: 7, hour: 16, seats: 40, taken: 18, tag: 'Vegetables', img: '/images/irrigating-farm.jpg' },
  { id: 3, topic: 'Reading your soil before you plant', host: 'Soil scientist · Ashanti', in: 12, hour: 11, seats: 80, taken: 23, tag: 'Soil', img: '/images/crop-rows.jpg' },
]

const recordings = [
  { topic: 'Storing grain to cut post-harvest losses', length: '48 min', notes: 'Notes PDF · 6 pages', attended: 72 },
  { topic: 'Writing fair input terms into your agreement', length: '35 min', notes: 'Checklist · 2 pages', attended: 54 },
  { topic: 'Pineapple: from sucker to harvest', length: '52 min', notes: 'Notes PDF · 9 pages', attended: 38 },
]

export default function LearnSection() {
  const [tab, setTab] = useState('upcoming')
  const [registered, setRegistered] = useState({})
  const sessions = useMemo(() => upcoming.map((s) => ({ ...s, when: daysFromNow(s.in, s.hour) })), [])

  return (
    <section id="learn" className="fl-section container">
      <div className="row g-4 align-items-end mb-5">
        <div className="col-lg-6" data-reveal>
          <span className="fl-eyebrow mb-3">Education sessions</span>
          <h2 className="fl-h-section mb-0">Learn from experts, <span className="fl-serif text-deep">wherever you farm</span></h2>
        </div>
        <div className="col-lg-5 offset-lg-1" data-reveal style={{ '--i': 1 }}>
          <p className="fl-lead mb-0">
            With one extension officer for about 1,500 farmers, a live session lets one expert reach a whole district at once.
            Register, join by video from your phone, and keep the notes afterwards.
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Photo with live session overlay */}
        <div className="col-lg-5" data-reveal="zoom">
          <div className="position-relative h-100 rounded-fl-xl overflow-hidden" style={{ minHeight: 440 }}>
            <img src="/images/farmer-tablet.jpg" alt="A farmer in his field following a lesson on a tablet" className="position-absolute fl-cover" loading="lazy" />
            <div className="position-absolute top-0 start-0 m-3"><span className="fl-pill lime"><span className="fl-live-dot" />Live now · 112 farmers</span></div>
            <div className="position-absolute bottom-0 start-0 end-0 p-3">
              <div className="fl-float">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="fl-icon-tile" style={{ width: 36, height: 36, fontSize: '1rem' }}><i className="bi bi-camera-video" /></span>
                  <div className="lh-sm"><div className="fw-semibold">Planting cassava for higher yield</div><div className="small text-muted-fl">Extension officer · Ashanti</div></div>
                </div>
                <div className="d-flex gap-2">
                  <span className="btn btn-primary btn-sm flex-grow-1"><i className="bi bi-box-arrow-up-right me-1" />Join on Jitsi</span>
                  <span className="btn btn-outline-primary btn-sm"><i className="bi bi-hand-index-thumb me-1" />Attendance recorded</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions list */}
        <div className="col-lg-7" data-reveal style={{ '--i': 1 }}>
          <div className="fl-card p-3 p-md-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="btn-group" role="tablist" aria-label="Sessions">
                <button type="button" role="tab" aria-selected={tab === 'upcoming'} className={`btn btn-sm ${tab === 'upcoming' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('upcoming')}>Upcoming</button>
                <button type="button" role="tab" aria-selected={tab === 'recordings'} className={`btn btn-sm ${tab === 'recordings' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('recordings')}>Notes & recordings</button>
              </div>
              <span className="small text-muted-fl"><i className="bi bi-phone me-1" />Works on any phone browser</span>
            </div>

            {tab === 'upcoming' ? (
              <div className="d-grid gap-3" key="up">
                {sessions.map((s, n) => {
                  const isReg = !!registered[s.id]
                  const taken = s.taken + (isReg ? 1 : 0)
                  return (
                    <div className="d-flex gap-3 align-items-center p-2 rounded-4 fl-row-hover fl-swap" key={s.id} style={{ animationDelay: `${n * 0.08}s` }}>
                      <div className="text-center flex-none rounded-4 py-2 px-1" style={{ width: 64, background: '#E8F3D2' }}>
                        <div className="small fw-semibold text-deep text-uppercase">{s.when.toLocaleDateString('en-GB', { month: 'short' })}</div>
                        <div className="fs-4 fw-semibold lh-1" style={{ fontFamily: 'Outfit' }}>{s.when.getDate()}</div>
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex flex-wrap gap-2 align-items-center mb-1"><span className="fl-pill" style={{ padding: '.1rem .6rem', fontSize: '.72rem' }}>{s.tag}</span><span className="small text-muted-fl">{fmtDate(s.when)} · {fmtTime(s.when)}</span></div>
                        <div className="fw-semibold lh-sm">{s.topic}</div>
                        <div className="small text-muted-fl">{s.host}</div>
                        <div className="progress mt-2" style={{ height: 4 }} aria-hidden="true"><div className="progress-bar bg-primary" style={{ width: `${(taken / s.seats) * 100}%` }} /></div>
                        <div className="small text-muted-fl mt-1">{taken} of {s.seats} seats taken</div>
                      </div>
                      <button type="button" className={`btn btn-sm flex-none ${isReg ? 'btn-lime' : 'btn-outline-primary'}`} aria-pressed={isReg} onClick={() => setRegistered((r) => ({ ...r, [s.id]: !r[s.id] }))}>
                        {isReg ? <><i className="bi bi-check-lg me-1" />Registered</> : 'Register'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="d-grid gap-3" key="rec">
                {recordings.map((r, n) => (
                  <div className="d-flex gap-3 align-items-center p-2 rounded-4 fl-row-hover fl-swap" key={r.topic} style={{ animationDelay: `${n * 0.08}s` }}>
                    <span className="fl-icon-tile soft flex-none"><i className="bi bi-play-circle" /></span>
                    <div className="flex-grow-1">
                      <div className="fw-semibold lh-sm">{r.topic}</div>
                      <div className="small text-muted-fl">{r.length} recording · {r.notes} · {r.attended} attended</div>
                    </div>
                    <span className="btn btn-sm btn-outline-primary flex-none"><i className="bi bi-download me-1" />Notes</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row g-3 mt-1">
            {[['bi-calendar-check', 'Register in one tap', 'Get a reminder before it starts.'], ['bi-person-check', 'Attendance on record', 'Shown on your public profile.'], ['bi-journal-text', 'Notes stay with you', 'Recordings and notes after each session.']].map(([icon, t, d], n) => (
              <div className="col-md-4" key={t} data-reveal style={{ '--i': n + 2 }}>
                <div className="d-flex gap-2"><i className={`bi ${icon} text-deep fs-5`} /><div><div className="fw-semibold small">{t}</div><div className="small text-muted-fl">{d}</div></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
