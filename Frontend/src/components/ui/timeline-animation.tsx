'use client'

import React from 'react'
import { motion, useInView, type Variants } from 'framer-motion'

type MotionTag = 'div' | 'h2' | 'p' | 'span'

interface TimelineContentProps {
  children: React.ReactNode
  animationNum: number
  timelineRef: React.RefObject<HTMLElement | null>
  customVariants?: Variants
  as?: MotionTag
  className?: string
}

const DEFAULT_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
}

const MOTION_TAGS: Record<MotionTag, React.ElementType> = {
  div: motion.div,
  h2: motion.h2,
  p: motion.p,
  span: motion.span,
}

export function TimelineContent({
  children,
  animationNum,
  timelineRef,
  customVariants,
  as = 'div',
  className,
}: TimelineContentProps) {
  const isInView = useInView(timelineRef, { once: true, amount: 0.12 })
  const Component = MOTION_TAGS[as]

  return (
    <Component
      custom={animationNum}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={customVariants ?? DEFAULT_VARIANTS}
      className={className}
    >
      {children}
    </Component>
  )
}
