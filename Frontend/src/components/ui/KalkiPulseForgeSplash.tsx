'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

// Normal unhurried cinematic forge timing
const STRIKE = 0.45
const COOLING = ['#FFF6DD', '#FFC285', '#FF814D', '#F5F3EF']
const GLOW = [
  '0 0 34px rgba(255,190,120,0.95)',
  '0 0 22px rgba(255,129,77,0.6)',
  '0 0 8px rgba(255,129,77,0.2)',
  '0 0 0 rgba(255,129,77,0)',
]

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const sparksFor = (seed: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI * (0.1 + 0.8 * rand(seed * 31 + i))
    const speed = 50 + 90 * rand(seed * 17 + i * 3)
    const round = (val: number) => Math.round(val * 10) / 10
    return {
      x: round(Math.cos(angle) * speed),
      y: round(Math.sin(angle) * speed),
      fall: round(30 + 50 * rand(seed * 7 + i * 11)),
      size: round(2 + 2.5 * rand(seed * 5 + i)),
      duration: round(0.55 + 0.35 * rand(seed * 13 + i * 5)),
    }
  })

type SparkType = ReturnType<typeof sparksFor>[number]

const Spark = ({ spark, at, go }: { spark: SparkType; at: number; go: boolean }) => {
  const sparkRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<Animation | null>(null)

  useEffect(() => {
    const node = sparkRef.current
    if (!go || !node || animRef.current) return
    const easing = 'ease-out'
    animRef.current = node.animate(
      [
        { opacity: 0, transform: 'translate(0px, 0px)', offset: 0, easing },
        { opacity: 1, transform: 'translate(0px, 0px)', offset: 0.02, easing },
        { opacity: 1, transform: `translate(${spark.x * 0.6}px, ${spark.y * 0.6}px)`, offset: 0.4, easing },
        { opacity: 0, transform: `translate(${spark.x}px, ${spark.y + spark.fall}px)`, offset: 1 },
      ],
      { duration: spark.duration * 1000, delay: at * 1000, fill: 'both' }
    )
  }, [go, spark, at])

  useEffect(() => {
    return () => {
      animRef.current?.cancel()
      animRef.current = null
    }
  }, [])

  return (
    <span
      ref={sparkRef}
      style={{
        opacity: 0,
        width: spark.size,
        height: spark.size,
        background: '#ffd9a0',
        boxShadow: '0 0 6px 1px rgba(255, 170, 90, 0.9), 0 0 14px 2px rgba(255, 129, 77, 0.45)',
      }}
      className="absolute rounded-full pointer-events-none"
    />
  )
}

const Sparks = ({ seed, count, at, go }: { seed: number; count: number; at: number; go: boolean }) => (
  <span aria-hidden className="pointer-events-none absolute bottom-[0.1em] left-1/2 size-0">
    {sparksFor(seed, count).map((spark, index) => (
      <Spark key={index} spark={spark} at={at} go={go} />
    ))}
  </span>
)

export interface KalkiPulseForgeSplashProps {
  onHandoffStart?: () => void
  onComplete?: () => void
  word?: string
}

export default function KalkiPulseForgeSplash({
  onHandoffStart,
  onComplete,
  word = 'KALKI Pulse',
}: KalkiPulseForgeSplashProps) {
  const [stage, setStage] = useState<'forge' | 'exit' | 'done'>('forge')
  const shakeX = useMotionValue(0)
  const finishedRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const LETTERS = useMemo(() => word.split(''), [word])
  const firstStrike = 0.28
  const strikeEvery = 0.23
  const strikeAt = (index: number) => firstStrike + index * strikeEvery
  const impactAt = (index: number) => strikeAt(index) + STRIKE * 0.35
  const DOT_AT = strikeAt(LETTERS.length) + 0.08
  const DOT_IMPACT = DOT_AT + 0.24
  const EXIT_AT = DOT_IMPACT + 0.95

  const later = (sec: number, fn: () => void) => {
    const t = window.setTimeout(fn, sec * 1000)
    timersRef.current.push(t)
    return t
  }

  const jolt = (strength: number) => {
    animate(shakeX, [0, -strength, strength * 0.6, 0], { duration: 0.16 })
  }

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setStage('done')
    onComplete?.()
  }

  useEffect(() => {
    LETTERS.forEach((_, index) => {
      later(impactAt(index), () => jolt(2.5))
    })
    later(DOT_IMPACT, () => jolt(4.5))
    later(EXIT_AT, () => {
      setStage('exit')
      onHandoffStart?.()
      // Allow 2.0s for the slow GPU-composited curtain dissolve to complete cleanly
      later(2.0, finish)
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  if (stage === 'done') return null

  const isExiting = stage === 'exit'

  return (
    <div
      aria-hidden
      style={{
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 1650ms cubic-bezier(0.22, 1, 0.36, 1) 200ms',
        willChange: 'opacity',
        transform: 'translateZ(0)',
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07090e] select-none overflow-hidden ${
        isExiting ? 'pointer-events-none' : ''
      }`}
    >
      {/* Ambient Forge Heat Glow — GPU-only opacity & transform fade */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'scale3d(1.25, 1.25, 1)' : 'scale3d(1, 1, 1)',
          transition:
            'opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1), transform 1400ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'opacity, transform',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.15 }}
          transition={{ duration: EXIT_AT, ease: 'easeOut' }}
          className="size-[85vmin] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(255, 129, 77, 0.22) 0%, rgba(255, 129, 77, 0.07) 42%, transparent 72%)',
          }}
        />
      </div>

      {/* Subtle warm-ember-to-cyan hairline light sweep (pure GPU scaleX + opacity) */}
      <div
        className="absolute w-[min(560px,80vw)] h-[1px] pointer-events-none"
        style={{
          opacity: 0,
          transform: 'scale3d(0, 1, 1)',
          animation: isExiting ? 'kalkiBridgeSweep 1200ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both' : undefined,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,129,77,0.65) 35%, rgba(0,240,255,0.65) 65%, transparent 100%)',
          willChange: 'transform, opacity',
        }}
      />
      <style>{`@keyframes kalkiBridgeSweep { 0% { opacity: 0; transform: scale3d(0,1,1); } 40% { opacity: 0.75; } 100% { opacity: 0; transform: scale3d(1.12,1,1); } }`}</style>

      {/* GPU-isolated Exit Wrapper (zero blur filter, zero textShadow repaint during exit) */}
      <div
        style={{
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'translate3d(0, -14px, 0) scale3d(0.97, 0.97, 1)' : 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
          transition:
            'opacity 1050ms cubic-bezier(0.22, 1, 0.36, 1), transform 1150ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'opacity, transform',
        }}
        className="relative flex flex-col items-center z-10 px-6"
      >
        {/* Wordmark Container */}
        <motion.div
          style={{ x: shakeX }}
          className="relative flex flex-col items-center"
        >
          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 0.9, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-[11px] font-mono tracking-[0.25em] text-[#ff814d] uppercase mb-4"
          >
            Influencer Impact &amp; ROI Intelligence
          </motion.p>

          <div
            className="relative flex items-baseline font-black leading-none text-white tracking-tight"
            style={{ fontSize: 'clamp(44px, 9vw, 120px)', fontFamily: "'Archivo', sans-serif" }}
          >
            {/* Letters */}
            {LETTERS.map((letter, index) => (
              <span key={index} className="relative inline-block">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    y: ['-0.35em', '0em', '0em'],
                    scaleY: [1.12, 0.82, 1],
                    scaleX: [0.93, 1.15, 1],
                    color: COOLING,
                    textShadow: GLOW,
                  }}
                  transition={{
                    opacity: { duration: 0.04, delay: strikeAt(index) },
                    y: { duration: STRIKE, delay: strikeAt(index), times: [0, 0.35, 1], ease: 'easeOut' },
                    scaleY: { duration: STRIKE, delay: strikeAt(index), times: [0, 0.35, 1] },
                    scaleX: { duration: STRIKE, delay: strikeAt(index), times: [0, 0.35, 1] },
                    color: { duration: 1.3, delay: strikeAt(index) + 0.08, times: [0, 0.2, 0.55, 1] },
                    textShadow: { duration: 1.3, delay: strikeAt(index) + 0.08, times: [0, 0.2, 0.55, 1] },
                  }}
                  className="inline-block origin-bottom"
                >
                  {letter === ' ' ? '\u00A0' : letter}
                </motion.span>

                {letter !== ' ' && (
                  <>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.45, delay: impactAt(index), times: [0, 0.15, 1] }}
                      className="absolute inset-x-[-25%] bottom-[-0.08em] h-[0.18em] pointer-events-none rounded-full"
                      style={{
                        background:
                          'radial-gradient(ellipse at center, rgba(255, 214, 160, 0.95) 0%, rgba(255, 129, 77, 0.55) 35%, transparent 70%)',
                        filter: 'blur(2px)',
                      }}
                    />
                    <Sparks seed={index + 1} count={14} at={impactAt(index)} go={true} />
                  </>
                )}
              </span>
            ))}

            {/* Ember Dot */}
            <span className="relative inline-block ml-1">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  y: ['-0.9em', '0em', '-0.08em', '0em'],
                  color: ['#FFF6DD', '#FFB870', '#FF814D', '#FF551F'],
                  textShadow: [
                    '0 0 24px #FFF6DD, 0 0 45px #FF814D',
                    '0 0 34px #FFAE66, 0 0 60px #FF814D',
                    '0 0 18px rgba(255,129,77,0.85)',
                    '0 0 10px rgba(255,85,31,0.65)',
                  ],
                }}
                transition={{
                  opacity: { duration: 0.05, delay: DOT_AT },
                  y: { duration: 0.48, delay: DOT_AT, times: [0, 0.55, 0.8, 1], ease: 'easeOut' },
                  color: { duration: 1.6, delay: DOT_AT, times: [0, 0.25, 0.65, 1] },
                  textShadow: { duration: 1.6, delay: DOT_AT, times: [0, 0.25, 0.65, 1] },
                }}
                className="inline-block origin-bottom"
              >
                .
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.5, delay: DOT_IMPACT, times: [0, 0.15, 1] }}
                className="absolute inset-x-[-100%] bottom-[-0.1em] h-[0.2em] pointer-events-none rounded-full"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(255, 230, 190, 1) 0%, rgba(255, 100, 30, 0.6) 40%, transparent 75%)',
                  filter: 'blur(2px)',
                }}
              />
              <Sparks seed={99} count={22} at={DOT_IMPACT} go={true} />
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
