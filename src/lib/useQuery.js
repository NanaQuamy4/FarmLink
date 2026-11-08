import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './supabase'

// Small data-loading hook: runs `fn` (which returns a Supabase query or a promise of data),
// tracks loading/error, and exposes reload(). deps work like useEffect deps.
export function useQuery(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fn()
      const value = res && typeof res === 'object' && 'data' in res && 'error' in res
        ? (() => { if (res.error) throw res.error; return res.data })()
        : res
      if (alive.current) setData(value)
    } catch (e) {
      if (alive.current) setError(errorMessage(e))
    } finally {
      if (alive.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    alive.current = true
    run()
    return () => { alive.current = false }
  }, [run])

  return { data, error, loading, reload: run, setData }
}
