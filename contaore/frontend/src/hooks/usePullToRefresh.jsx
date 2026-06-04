import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72

export function usePullToRefresh(onRefresh) {
  const [state, setState]   = useState({ pulling: false, refreshing: false, distance: 0 })
  const startY              = useRef(null)
  const shouldRefresh       = useRef(false)
  const onRefreshRef        = useRef(onRefresh)
  onRefreshRef.current      = onRefresh

  useEffect(() => {
    function onTouchStart(e) {
      if (window.scrollY <= 0) {
        startY.current      = e.touches[0].clientY
        shouldRefresh.current = false
      }
    }

    function onTouchMove(e) {
      if (startY.current === null) return
      const dist = e.touches[0].clientY - startY.current
      if (dist > 0 && window.scrollY <= 0) {
        shouldRefresh.current = dist >= THRESHOLD
        setState(s => ({ ...s, distance: Math.min(dist, THRESHOLD * 1.5), pulling: dist >= THRESHOLD }))
      } else if (dist <= 0 || window.scrollY > 0) {
        startY.current = null
        shouldRefresh.current = false
        setState({ pulling: false, refreshing: false, distance: 0 })
      }
    }

    function onTouchEnd() {
      startY.current = null
      if (shouldRefresh.current) {
        shouldRefresh.current = false
        setState({ pulling: false, refreshing: true, distance: 0 })
        const done   = () => setState({ pulling: false, refreshing: false, distance: 0 })
        const result = onRefreshRef.current()
        if (result && typeof result.finally === 'function') result.finally(done)
        else setTimeout(done, 800)
      } else {
        setState({ pulling: false, refreshing: false, distance: 0 })
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [])

  return state
}

export function PullIndicator({ pulling, refreshing, distance }) {
  if (!refreshing && distance <= 10) return null
  const h = refreshing ? 44 : Math.min(distance * 0.55, 44)
  return (
    <div className="flex items-center justify-center overflow-hidden transition-all duration-150" style={{ height: h }}>
      <div className={`w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-800 dark:border-t-zinc-200 ${
        refreshing || pulling ? 'animate-spin' : ''
      }`} />
    </div>
  )
}
