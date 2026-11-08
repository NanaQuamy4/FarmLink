import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Landing from './pages/Landing'
import SiteNav from './components/SiteNav'
import AppLayout from './app/AppLayout'
import UserLayout from './app/UserLayout'
import { useAuth } from './lib/auth'
import { RequireAuth, RequireRole, GuestOnly } from './app/guards'

// Every page except the landing page loads on demand, so the first visit downloads less.
const Credits = lazy(() => import('./pages/Credits'))
const Setup = lazy(() => import('./pages/Setup'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/PasswordReset').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/auth/PasswordReset').then((m) => ({ default: m.ResetPassword })))
const Dashboard = lazy(() => import('./pages/app/Dashboard'))
const Notifications = lazy(() => import('./pages/app/Notifications'))
const Profile = lazy(() => import('./pages/app/Profile'))
const MyPlots = lazy(() => import('./pages/app/plots/MyPlots'))
const PlotForm = lazy(() => import('./pages/app/plots/PlotForm'))
const PlotDetail = lazy(() => import('./pages/app/plots/PlotDetail'))
const FindLand = lazy(() => import('./pages/app/plots/FindLand'))
const VerifyQueue = lazy(() => import('./pages/app/verify/VerifyQueue'))
const VerifyPlot = lazy(() => import('./pages/app/verify/VerifyPlot'))
const Applications = lazy(() => import('./pages/app/deals/Applications'))
const ApplicationDetail = lazy(() => import('./pages/app/deals/ApplicationDetail'))
const Messages = lazy(() => import('./pages/app/deals/Messages'))
const Deals = lazy(() => import('./pages/app/deals/Deals'))
const DealDetail = lazy(() => import('./pages/app/deals/DealDetail'))
const DisputeList = lazy(() => import('./pages/app/verify/Disputes').then((m) => ({ default: m.DisputeList })))
const DisputeMediation = lazy(() => import('./pages/app/verify/Disputes').then((m) => ({ default: m.DisputeMediation })))
const AdminUsers = lazy(() => import('./pages/app/admin/Admin').then((m) => ({ default: m.AdminUsers })))
const AdminVerifiers = lazy(() => import('./pages/app/admin/Admin').then((m) => ({ default: m.AdminVerifiers })))
const AdminPlots = lazy(() => import('./pages/app/admin/Admin').then((m) => ({ default: m.AdminPlots })))
const AdminReports = lazy(() => import('./pages/app/admin/Admin').then((m) => ({ default: m.AdminReports })))
const GroupList = lazy(() => import('./pages/app/community/Groups').then((m) => ({ default: m.GroupList })))
const GroupDetail = lazy(() => import('./pages/app/community/Groups').then((m) => ({ default: m.GroupDetail })))
const SessionList = lazy(() => import('./pages/app/community/Sessions').then((m) => ({ default: m.SessionList })))
const SessionDetail = lazy(() => import('./pages/app/community/Sessions').then((m) => ({ default: m.SessionDetail })))
const Marketplace = lazy(() => import('./pages/app/community/Market').then((m) => ({ default: m.Marketplace })))
const ListingDetail = lazy(() => import('./pages/app/community/Market').then((m) => ({ default: m.ListingDetail })))
const MyOffers = lazy(() => import('./pages/app/community/Market').then((m) => ({ default: m.MyOffers })))
const PublicProfile = lazy(() => import('./pages/app/community/PublicProfile'))
const HelpCenter = lazy(() => import('./pages/app/Support').then((m) => ({ default: m.HelpCenter })))
const TicketPage = lazy(() => import('./pages/app/Support').then((m) => ({ default: m.TicketPage })))
const AdminSupport = lazy(() => import('./pages/app/Support').then((m) => ({ default: m.AdminSupport })))

function PageLoading() {
  return (
    <div className="d-grid" style={{ minHeight: '50vh', placeItems: 'center' }} role="status">
      <span className="spinner-border text-success" aria-hidden="true" /><span className="visually-hidden">Loading…</span>
    </div>
  )
}

function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="container fl-section text-center">
        <h1 className="fl-h-section">Page not found</h1>
        <p className="fl-lead">The page you are looking for does not exist.</p>
        <Link to="/" className="btn btn-primary">Back home</Link>
      </main>
    </>
  )
}

// Admins and verifiers work in the sidebar dashboard; landowners, farmers and buyers get the
// site-style layout with a top pill menu.
function RoleLayout() {
  const { role } = useAuth()
  return role === 'admin' || role === 'verifier' ? <AppLayout /> : <UserLayout />
}

const L = ['landowner', 'admin']
const F = ['farmer', 'admin']
const V = ['verifier', 'admin']
const A = ['admin']

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth><RoleLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/help/:id" element={<TicketPage />} />
        <Route path="/admin/support" element={<RequireRole roles={A}><AdminSupport /></RequireRole>} />
        <Route path="/admin/support/:id" element={<RequireRole roles={A}><TicketPage /></RequireRole>} />
        <Route path="/u/:id" element={<PublicProfile />} />

        {/* Landowner */}
        <Route path="/plots" element={<RequireRole roles={L}><MyPlots /></RequireRole>} />
        <Route path="/plots/new" element={<RequireRole roles={L}><PlotForm /></RequireRole>} />
        <Route path="/plots/:id" element={<PlotDetail />} />
        <Route path="/plots/:id/edit" element={<RequireRole roles={L}><PlotForm /></RequireRole>} />

        {/* Farmer */}
        <Route path="/find" element={<RequireRole roles={F}><FindLand /></RequireRole>} />
        <Route path="/find/:id" element={<PlotDetail />} />

        {/* Shared deal flow */}
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:applicationId" element={<Messages />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/deals/:id" element={<DealDetail />} />

        {/* Verifier */}
        <Route path="/verify" element={<RequireRole roles={V}><VerifyQueue /></RequireRole>} />
        <Route path="/verify/plots/:id" element={<RequireRole roles={V}><VerifyPlot /></RequireRole>} />
        <Route path="/verify/disputes" element={<RequireRole roles={V}><DisputeList /></RequireRole>} />
        <Route path="/verify/disputes/:id" element={<RequireRole roles={V}><DisputeMediation /></RequireRole>} />

        {/* Admin */}
        <Route path="/admin/users" element={<RequireRole roles={A}><AdminUsers /></RequireRole>} />
        <Route path="/admin/verifiers" element={<RequireRole roles={A}><AdminVerifiers /></RequireRole>} />
        <Route path="/admin/plots" element={<RequireRole roles={A}><AdminPlots /></RequireRole>} />
        <Route path="/admin/disputes" element={<RequireRole roles={A}><DisputeList /></RequireRole>} />
        <Route path="/admin/reports" element={<RequireRole roles={A}><AdminReports /></RequireRole>} />

        {/* Extended */}
        <Route path="/groups" element={<GroupList />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/sessions" element={<SessionList />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/market" element={<Marketplace />} />
        <Route path="/market/listings/:id" element={<ListingDetail />} />
        <Route path="/market/offers" element={<RequireRole roles={['buyer', 'admin']}><MyOffers /></RequireRole>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
