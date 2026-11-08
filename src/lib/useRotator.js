import { useCallback, useEffect, useState } from 'react'

// Cycles an index through 0..count-1 every `interval` ms.
// Does not autoplay for reduced-motion users and pauses while the tab is hidden.
export function useRotator(count, interval = 7000) {
  const [index, setIndex] = useState(0)
  const [tick, setTick] = useState(0) // bumps when the user picks a slide, restarting the timer

  useEffect(() => {
    if (count < 2) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count)
    }, interval)
    return () => clearInterval(id)
  }, [count, interval, tick])

  const goTo = useCallback((i) => {
    setIndex(i)
    setTick((t) => t + 1)
  }, [])

  return [index, goTo]
}
