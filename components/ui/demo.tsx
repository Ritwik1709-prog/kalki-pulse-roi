import { useState } from 'react'
import Forge from '@/components/ui/forge-hardware-hero'
import type { ForgeProps } from '@/components/ui/forge-hardware-hero'

/**
 * Forge demo: Hardware-shop hero for KALKI Pulse.
 * The fonts (Archivo variable, Geist Mono) and the bench photo are embedded/served locally so no network is needed.
 * Dependencies: motion (framer-motion), lucide-react
 */

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400..900&family=Geist+Mono:wght@400..700&display=swap');
`

const createSvgIcon = (content: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23ff6432" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`

const SVG_ICONS = {
  drill: createSvgIcon(
    '%3Cpath d="M14 9l6 6M4 4l4 4M2 14l2-2 6 6-2 2a3 3 0 0 1-4.24 0L2 18.24A3 3 0 0 1 2 14zM10 8l4-4 2 2-4 4"/%3E'
  ),
  hammer: createSvgIcon(
    '%3Cpath d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/%3E%3Cpath d="M17.64 15 22 10.64"/%3E%3Cpath d="m20.91 3.26-6.36 6.36"/%3E%3Cpath d="m14.5 4.5 1.5 1.5"/%3E'
  ),
  ruler: createSvgIcon(
    '%3Cpath d="m19 5-3.5 3.5"/%3E%3Cpath d="m14 10-2 2"/%3E%3Cpath d="m9 15-2 2"/%3E%3Cpath d="M2 22 22 2"/%3E'
  ),
  glasses: createSvgIcon(
    '%3Ccircle cx="6" cy="15" r="4"/%3E%3Ccircle cx="18" cy="15" r="4"/%3E%3Cpath d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/%3E%3Cpath d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/%3E%3Cpath d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/%3E'
  ),
  wrench: createSvgIcon(
    '%3Cpath d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/%3E'
  ),
  scissors: createSvgIcon(
    '%3Ccircle cx="6" cy="6" r="3"/%3E%3Cpath d="M8.12 8.12 12 12"/%3E%3Cpath d="M20 4 8.12 15.88"/%3E%3Ccircle cx="6" cy="18" r="3"/%3E%3Cpath d="M14.8 14.8 20 20"/%3E'
  )
}

const DEMO_PROJECTS = [
  {
    id: 'all',
    label: 'All tools',
    icon: 'layout-grid',
    tools: ['drill', 'hammer', 'ruler', 'glasses', 'wrench', 'scissors'],
    title: ['Build Better', 'Every Day.', 'KALKI Pulse.']
  },
  {
    id: 'shelf',
    label: 'Hang a shelf',
    icon: 'panel-top',
    tools: ['hammer', 'ruler', 'glasses'],
    title: ['Precision Craft.', 'Exact Level.', 'Zero Guesswork.']
  },
  {
    id: 'pipe',
    label: 'Fix a pipe',
    icon: 'wrench',
    tools: ['wrench', 'glasses'],
    title: ['Clean Lines.', 'Watertight Fits.', 'Zero Compromise.']
  }
]

const DEMO_CATEGORIES: Record<string, any> = {
  power: {
    label: 'Power Tools',
    icon: 'drill',
    href: '#power',
    blurb: 'High-torque drills & drivers'
  },
  hand: {
    label: 'Hand Tools',
    icon: 'hammer',
    href: '#hand',
    blurb: 'Forged hammers & saws'
  },
  measure: {
    label: 'Measuring',
    icon: 'ruler',
    href: '#measure',
    blurb: 'Steel rulers & precision gauges'
  },
  safety: {
    label: 'Safety Gear',
    icon: 'glasses',
    href: '#safety',
    blurb: 'Protective goggles & gear'
  }
}

const DEMO_TOOLS: Record<string, any> = {
  drill: {
    name: 'Cordless Drill',
    category: 'power',
    href: '#drill',
    box: [68, 38, 28, 28],
    image: SVG_ICONS.drill
  },
  hammer: {
    name: 'Claw Hammer',
    category: 'hand',
    href: '#hammer',
    box: [10, 42, 22, 45],
    image: SVG_ICONS.hammer
  },
  ruler: {
    name: 'Steel Ruler',
    category: 'measure',
    href: '#ruler',
    box: [28, 55, 12, 35],
    image: SVG_ICONS.ruler
  },
  glasses: {
    name: 'Safety Glasses',
    category: 'safety',
    href: '#glasses',
    box: [36, 45, 14, 18],
    image: SVG_ICONS.glasses
  },
  wrench: {
    name: 'Adjustable Wrench',
    category: 'hand',
    href: '#wrench',
    box: [48, 52, 14, 25],
    image: SVG_ICONS.wrench
  },
  scissors: {
    name: 'Shop Shears',
    category: 'hand',
    href: '#scissors',
    box: [45, 5, 48, 24],
    image: SVG_ICONS.scissors
  }
}

export default function Demo() {
  return (
    <>
      <style>{FONT_CSS}</style>
      <Forge
        brand={{ name: 'KALKI Pulse', href: '/' }}
        nav={{
          links: [
            { label: 'Shop', href: '#shop' },
            { label: 'Categories', href: '#categories', menu: true },
            { label: 'Brands', href: '#brands' },
            { label: 'Deals', href: '#deals' },
            { label: 'Support', href: '#support' }
          ],
          search: { action: '#search', placeholder: 'Search products' },
          account: { label: 'Account', href: '/auth' },
          cart: { label: 'Cart', href: '#cart' },
          frostAfter: 12
        }}
        copy={{
          eyebrow: 'TOOLS FOR REAL PROGRESS',
          subtext: 'Quality tools, trusted brands, and everything you need to bring your ideas to life — at home or on the job.',
          primary: { label: 'Shop Tools', href: '#shop' },
          secondary: { label: 'Explore Categories', href: '#categories' },
          picker: 'WHAT ARE YOU BUILDING?',
          hint: 'TAP ANY TOOL TO ADD OR REMOVE IT',
          trust: ['Trade-tested quality', 'Free workshop returns', 'Expert technical advice']
        }}
        categories={DEMO_CATEGORIES}
        categoryOrder={['power', 'hand', 'measure', 'safety']}
        tools={DEMO_TOOLS}
        projects={DEMO_PROJECTS as any}
        boardImage={{
          large: '/workbench-board.webp',
          small: '/workbench-board.webp',
          width: 1600,
          height: 1066,
          alt: 'Workshop tool board'
        }}
        splash={{
          enabled: true,
          oncePerSession: false,
          skipBelow: 0,
        }}
      />
    </>
  )
}
export { Demo }
