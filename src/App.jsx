import { Routes, Route, Link } from 'react-router-dom'
import Landing from './pages/Landing'
import Credits from './pages/Credits'
import SiteNav from './components/SiteNav'

function ComingSoon({ title }) {
  return (
    <>
      <SiteNav />
      <main className="container fl-section text-center">
        <h1 className="fl-h-section">{title}</h1>
        <p className="fl-lead">This page is being built next.</p>
        <Link to="/" className="btn btn-primary">Back home</Link>
      </main>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/login" element={<ComingSoon title="Log in" />} />
      <Route path="/register" element={<ComingSoon title="Create account" />} />
      <Route path="*" element={<ComingSoon title="Page not found" />} />
    </Routes>
  )
}
