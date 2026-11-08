import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'

// Shown when the app has no Supabase keys yet.
export default function Setup() {
  return (
    <>
      <SiteNav />
      <main className="container fl-section" style={{ maxWidth: 760 }}>
        <span className="fl-eyebrow mb-3">Setup</span>
        <h1 className="fl-h-section mb-3">Connect FarmLink to Supabase</h1>
        <p className="fl-lead">The app needs a Supabase project before anyone can sign in.</p>
        <ol className="d-grid gap-3 mt-4">
          <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li>
          <li>In the SQL editor, run <code>supabase/migrations/0001</code> to <code>0004</code> in order, then <code>supabase/seed.sql</code> for demo data.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> and paste the Project URL and anon key from Project Settings → API.</li>
          <li>Restart <code>npm run dev</code>.</li>
        </ol>
        <Link to="/" className="btn btn-primary mt-3">Back to the home page</Link>
      </main>
    </>
  )
}
