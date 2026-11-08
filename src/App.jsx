import { Routes, Route, Link } from 'react-router-dom'
import Landing from './pages/Landing'
import Credits from './pages/Credits'
import Setup from './pages/Setup'
import SiteNav from './components/SiteNav'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import { ForgotPassword, ResetPassword } from './pages/auth/PasswordReset'
import AppLayout from './app/AppLayout'
import { RequireAuth, RequireRole, GuestOnly } from './app/guards'
import Dashboard from './pages/app/Dashboard'
import Notifications from './pages/app/Notifications'
import Profile from './pages/app/Profile'
import { EmptyState } from './components/ui'

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

// Placeholder for app pages still being built
const Soon = ({ title }) => <EmptyState icon="bi-hammer" title={title} text="This page is being built next." />

const L = ['landowner', 'admin']
const F = ['farmer', 'admin']
const V = ['verifier', 'admin']
const A = ['admin']

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:id" element={<Soon title="Public profile" />} />

        {/* Landowner */}
        <Route path="/plots" element={<RequireRole roles={L}><Soon title="My plots" /></RequireRole>} />
        <Route path="/plots/new" element={<RequireRole roles={L}><Soon title="List a plot" /></RequireRole>} />
        <Route path="/plots/:id" element={<Soon title="Plot" />} />
        <Route path="/plots/:id/edit" element={<RequireRole roles={L}><Soon title="Edit plot" /></RequireRole>} />

        {/* Farmer */}
        <Route path="/find" element={<RequireRole roles={F}><Soon title="Find land" /></RequireRole>} />
        <Route path="/find/:id" element={<Soon title="Plot details" />} />

        {/* Shared deal flow */}
        <Route path="/applications" element={<Soon title="Applications" />} />
        <Route path="/applications/:id" element={<Soon title="Application" />} />
        <Route path="/messages" element={<Soon title="Messages" />} />
        <Route path="/messages/:applicationId" element={<Soon title="Chat" />} />
        <Route path="/deals" element={<Soon title="Deals" />} />
        <Route path="/deals/:id" element={<Soon title="Deal" />} />

        {/* Verifier */}
        <Route path="/verify" element={<RequireRole roles={V}><Soon title="Verification queue" /></RequireRole>} />
        <Route path="/verify/plots/:id" element={<RequireRole roles={V}><Soon title="Verify plot" /></RequireRole>} />
        <Route path="/verify/disputes" element={<RequireRole roles={V}><Soon title="Disputes" /></RequireRole>} />
        <Route path="/verify/disputes/:id" element={<RequireRole roles={V}><Soon title="Dispute" /></RequireRole>} />

        {/* Admin */}
        <Route path="/admin/users" element={<RequireRole roles={A}><Soon title="Users" /></RequireRole>} />
        <Route path="/admin/verifiers" element={<RequireRole roles={A}><Soon title="Verifiers" /></RequireRole>} />
        <Route path="/admin/plots" element={<RequireRole roles={A}><Soon title="Plots" /></RequireRole>} />
        <Route path="/admin/disputes" element={<RequireRole roles={A}><Soon title="Disputes" /></RequireRole>} />
        <Route path="/admin/reports" element={<RequireRole roles={A}><Soon title="Reports" /></RequireRole>} />

        {/* Extended */}
        <Route path="/groups" element={<Soon title="Groups" />} />
        <Route path="/groups/:id" element={<Soon title="Group" />} />
        <Route path="/sessions" element={<Soon title="Sessions" />} />
        <Route path="/sessions/:id" element={<Soon title="Session" />} />
        <Route path="/market" element={<Soon title="Marketplace" />} />
        <Route path="/market/listings/:id" element={<Soon title="Listing" />} />
        <Route path="/market/offers" element={<Soon title="Offers" />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
