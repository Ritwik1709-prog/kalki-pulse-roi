import React, { useEffect, useRef, useState } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  y?: number
  duration?: number
  className?: string
}

/**
 * Pure GPU-composited scroll-triggered reveal (opacity + translate3d only).
 * Uses a one-shot IntersectionObserver so there is zero per-frame JS work.
 */
export default function ScrollReveal({
  children,
  delay = 0,
  y = 24,
  duration = 900,
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [settled, setSettled] = useState(visible)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || settled) return
    const t = window.setTimeout(() => setSettled(true), duration + delay + 80)
    return () => clearTimeout(t)
  }, [visible, settled, duration, delay])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: settled
          ? 'none'
          : visible
          ? 'translate3d(0, 0, 0)'
          : `translate3d(0, ${y}px, 0)`,
        transition: settled
          ? undefined
          : `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: settled ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
