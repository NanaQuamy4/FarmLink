import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isConfigured } from '../lib/supabase'
import { Loading, EmptyState } from '../components/ui'

export function RequireAuth({ children }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (!isConfigured) return <Navigate to="/setup" replace />
  if (loading || (session && !profile)) return <div className="min-vh-100 d-grid" style={{ placeItems: 'center' }}><Loading /></div>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export function RequireRole({ roles, children }) {
  const { role } = useAuth()
  if (!roles.includes(role)) {
    return <EmptyState icon="bi-lock" title="This page is not for your account" text="Use the menu to find the pages for your role." />
  }
  return children
}

export function GuestOnly({ children }) {
  const { session, loading } = useAuth()
  if (!isConfigured) return <Navigate to="/setup" replace />
  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />
  return children
}
