import { useEffect, useRef, useState } from 'react'

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Counts from 0 to `to` the first time the number scrolls into view.
export default function CountUp({ to, prefix = '', suffix = '', duration = 1400, className = '' }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      setValue(to)
      return undefined
    }
    let frame
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        setValue(Math.round(to * (1 - (1 - t) ** 3)))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(frame) }
  }, [to, duration])

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${to.toLocaleString('en-GH')}${suffix}`}>
      <span aria-hidden="true">{prefix}{value.toLocaleString('en-GH')}{suffix}</span>
    </span>
  )
}
