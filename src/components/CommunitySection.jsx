import { useState } from 'react'

// Farmer community groups (FR12): groups by region or crop, group chat and a notice board.
// Group names and posts are illustrative examples.

const groups = [
  { name: 'Techiman Maize Growers', kind: 'Crop · Maize', region: 'Bono East', members: 48, icon: 'bi-flower1' },
  { name: 'Volta Youth Vegetable Club', kind: 'Crop · Vegetables', region: 'Volta', members: 31, icon: 'bi-basket2' },
  { name: 'Tamale Rice Farmers', kind: 'Region · Northern', region: 'Northern', members: 57, icon: 'bi-geo-alt' },
  { name: 'Ekumfi Pineapple Network', kind: 'Crop · Pineapple', region: 'Central', members: 22, icon: 'bi-sun' },
]

const notices = [
  { icon: 'bi-people-fill', tone: 'lime', title: 'Nnoboa labour day', text: 'Weeding on Kwame’s plot, Saturday 7am. Next week we move to Efua’s.', meta: '9 going', action: 'I’ll come' },
  { icon: 'bi-bag-check', tone: 'soft', title: 'Group fertiliser purchase', text: 'Buying NPK together for a better price. Add your bags by Friday.', meta: '14 joined', action: 'Join' },
  { icon: 'bi-cloud-rain', tone: 'soft', title: 'Planting window', text: 'Rains are settling in. Shared by the group’s verifier after this week’s session.', meta: 'Pinned', action: null },
]

export default function CommunitySection() {
  const [joined, setJoined] = useState({})
  const [going, setGoing] = useState({})

  return (
    <section id="community" className="fl-section fl-section-dark fl-on-dark fl-rounded-band">
      <div className="container">
        <div className="row g-4 align-items-end mb-5">
          <div className="col-lg-6" data-reveal>
            <span className="fl-eyebrow mb-3">Farmer community</span>
            <h2 className="fl-h-section mb-0">Farm together, <span className="fl-serif text-lime">like nnoboa</span></h2>
          </div>
          <div className="col-lg-5 offset-lg-1" data-reveal style={{ '--i': 1 }}>
            <p className="mb-0">
              Unpredictable rains have made it harder to plan shared labour. Groups by region or crop give farmers one place
              to organise labour days, buy inputs together and share what works.
            </p>
          </div>
        </div>

        <div className="row g-4">
          {/* Groups */}
          <div className="col-lg-4" data-reveal>
            <div className="d-grid gap-3">
              {groups.map((g) => {
                const isIn = !!joined[g.name]
                return (
                  <div className="fl-card-dark fl-lift d-flex align-items-center gap-3 p-3" key={g.name}>
                    <span className="fl-icon-tile flex-none"><i className={`bi ${g.icon}`} /></span>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-white lh-sm">{g.name}</div>
                      <div className="small">{g.kind} · {g.members + (isIn ? 1 : 0)} members</div>
                    </div>
                    <button type="button" className={`btn btn-sm flex-none ${isIn ? 'btn-lime' : 'btn-outline-light-fl'}`} aria-pressed={isIn} onClick={() => setJoined((j) => ({ ...j, [g.name]: !j[g.name] }))}>
                      {isIn ? <i className="bi bi-check-lg" aria-label="Joined" /> : 'Join'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notice board */}
          <div className="col-md-6 col-lg-4" data-reveal style={{ '--i': 1 }}>
            <div className="fl-mock h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <strong><i className="bi bi-pin-angle me-1" />Notice board</strong>
                <span className="small text-muted-fl">Techiman Maize Growers</span>
              </div>
              <div className="d-grid gap-3">
                {notices.map((n) => {
                  const isGoing = !!going[n.title]
                  return (
                    <div className="d-flex gap-3" key={n.title}>
                      <span className={`fl-icon-tile flex-none ${n.tone === 'soft' ? 'soft' : ''}`} style={{ width: 40, height: 40, fontSize: '1.05rem' }}><i className={`bi ${n.icon}`} /></span>
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{n.title}</div>
                        <div className="small text-muted-fl mb-1">{n.text}</div>
                        <div className="d-flex align-items-center gap-2 small">
                          <span className="text-muted-fl">{n.meta === 'Pinned' ? n.meta : `${parseInt(n.meta, 10) + (isGoing ? 1 : 0)} ${n.meta.split(' ').slice(1).join(' ')}`}</span>
                          {n.action && (
                            <button type="button" className={`btn btn-sm py-0 px-2 ${isGoing ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={isGoing} onClick={() => setGoing((g) => ({ ...g, [n.title]: !g[n.title] }))}>
                              {isGoing ? 'Done' : n.action}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Group chat over a photo of shared work */}
          <div className="col-md-6 col-lg-4" data-reveal style={{ '--i': 2 }}>
            <div className="position-relative h-100 rounded-fl-xl overflow-hidden" style={{ minHeight: 420 }}>
              <img src="/images/farmers-weeding.jpg" alt="A group of farmers weeding a field together" className="position-absolute fl-cover" loading="lazy" />
              <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(180deg, rgba(3,43,31,0) 30%, rgba(3,43,31,.85))' }} />
              <div className="position-absolute bottom-0 start-0 end-0 p-3 d-grid gap-2">
                <div className="fl-bubble them" style={{ background: 'rgba(255,255,255,.92)', color: 'var(--fl-ink)' }}><strong className="d-block small">Efua</strong>Who has a sprayer we can share on Saturday?</div>
                <div className="fl-bubble them" style={{ background: 'rgba(255,255,255,.92)', color: 'var(--fl-ink)' }}><strong className="d-block small">Yaw</strong>Mine is free. I’ll bring it to Kwame’s plot.</div>
                <div className="fl-bubble me" style={{ background: 'var(--fl-lime)', color: 'var(--fl-deep)' }}>Thank you! See you all at 7.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
