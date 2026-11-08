// Menu for each role. `mobile: true` items appear in the phone bottom bar (max 4; the rest are under "More").
const common = {
  dashboard: { to: '/dashboard', label: 'Dashboard', icon: 'bi-grid-1x2', mobile: true },
  messages: { to: '/messages', label: 'Messages', icon: 'bi-chat-dots', mobile: true },
  deals: { to: '/deals', label: 'Deals', icon: 'bi-file-earmark-check', mobile: true },
  groups: { to: '/groups', label: 'Groups', icon: 'bi-people', section: 'Community' },
  sessions: { to: '/sessions', label: 'Sessions', icon: 'bi-camera-video', section: 'Community' },
  market: { to: '/market', label: 'Marketplace', icon: 'bi-basket', section: 'Community' },
}

export const NAV = {
  landowner: [
    common.dashboard,
    { to: '/plots', label: 'My plots', icon: 'bi-geo-alt', mobile: true },
    { to: '/applications', label: 'Applications', icon: 'bi-inbox' },
    common.deals,
    common.messages,
    common.groups, common.sessions, common.market,
  ],
  farmer: [
    common.dashboard,
    { to: '/find', label: 'Find land', icon: 'bi-search', mobile: true },
    { to: '/applications', label: 'My applications', icon: 'bi-send' },
    common.deals,
    common.messages,
    common.groups, common.sessions,
    { to: '/market', label: 'Sell produce', icon: 'bi-basket', section: 'Community' },
  ],
  verifier: [
    common.dashboard,
    { to: '/verify', label: 'Verification queue', icon: 'bi-patch-check', mobile: true },
    { to: '/verify/disputes', label: 'Disputes', icon: 'bi-shield-check', mobile: true },
    { ...common.deals, label: 'Assigned deals' },
    { to: '/sessions', label: 'Sessions', icon: 'bi-camera-video', section: 'Community' },
    common.groups,
  ],
  admin: [
    { ...common.dashboard, label: 'Overview' },
    { to: '/admin/users', label: 'Users', icon: 'bi-people', mobile: true },
    { to: '/admin/verifiers', label: 'Verifiers', icon: 'bi-person-badge' },
    { to: '/admin/plots', label: 'Plots', icon: 'bi-geo-alt', mobile: true },
    { to: '/deals', label: 'Deals', icon: 'bi-file-earmark-check' },
    { to: '/admin/disputes', label: 'Disputes', icon: 'bi-shield-check' },
    { to: '/admin/reports', label: 'Reports', icon: 'bi-bar-chart', mobile: true },
    { to: '/admin/support', label: 'Support', icon: 'bi-headset' },
    { ...common.sessions, section: 'Community' }, common.groups, common.market,
  ],
  buyer: [
    common.dashboard,
    { to: '/market', label: 'Marketplace', icon: 'bi-basket', mobile: true },
    { to: '/market/offers', label: 'My offers', icon: 'bi-tags', mobile: true },
    { to: '/groups', label: 'Groups', icon: 'bi-people', section: 'Community' },
  ],
}
