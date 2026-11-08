import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key && !url.includes('your-project-ref'))

export const supabase = isConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

// Turn a Supabase/Postgres error into a sentence for the user. RPC errors raised in our SQL
// functions are already written for people, so they pass through unchanged.
export function errorMessage(error) {
  if (!error) return ''
  const msg = error.message || String(error)
  if (/row-level security/i.test(msg)) return 'You do not have permission to do that.'
  if (/duplicate key/i.test(msg)) return 'That already exists.'
  if (/Invalid login credentials/i.test(msg)) return 'Email or password is incorrect.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Cannot reach FarmLink. Check your internet connection and try again.'
  return msg
}

// Throws the Supabase error so callers can use try/catch with errorMessage().
export async function must(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}
