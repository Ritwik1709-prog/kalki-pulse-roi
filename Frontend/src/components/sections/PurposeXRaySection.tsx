import React, { useState } from 'react'
import { motion } from 'framer-motion'
import CipherNumber from '../ui/CipherNumber'
import SpotlightCard from '../ui/SpotlightCard'
import ScrollReveal from '../ui/ScrollReveal'
import { NykaaLogo } from '../ui/PartnerLogos'

export default function PurposeXRaySection({ onToggle }: { onToggle: () => void }) {
  const [isXRay, setIsXRay] = useState(true)

  const rawStats = [
    { label: 'Reported Subscribers', value: '850,000', color: 'text-white' },
    { label: 'Surface Engagement', value: '45,200', color: 'text-white' },
    { label: 'Agency Fit Claim', value: '99% Match', color: 'text-white' },
    { label: 'Estimated Views', value: '1.2M Views', color: 'text-white' },
    { label: 'Claimed ROI', value: 'Est. 5×', color: 'text-amber-400' }
  ]

  const xrayStats = [
    { label: 'Verified Human Reach', value: '142,500', color: 'text-cyan-300' },
    { label: 'Buyer Purchase Intent', value: 'High', color: 'text-cyan-300' },
    { label: 'Category Audience Fit', value: '88.4%', color: 'text-[#FC2779]' },
    { label: 'Predicted Store Orders', value: '259 Orders', color: 'text-emerald-400' },
    { label: 'Expected Net ROI', value: '+210.8%', color: 'text-emerald-400' }
  ]

  const handleToggle = (val: boolean) => {
    setIsXRay(val)
    onToggle()
  }

  return (
    <section id="purpose" className="relative px-6 md:px-16 py-32 overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="grid lg:grid-cols-12 gap-14 items-center max-w-7xl mx-auto">
        {/* Left Column: Customer-facing value */}
        <ScrollReveal className="lg:col-span-6 space-y-7" y={28} duration={950}>
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass border border-cyan-400/30 text-cyan-300">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              CREATOR AUDIT
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Shattering the <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
              Vanity Metric
            </span>{' '}
            Illusion.
          </h2>

          <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-xl font-normal">
            Brands waste up to <strong className="text-white font-semibold">41.8% of creator budgets</strong> on inflated follower counts and passive likes that never turn into actual orders.
          </p>

          {/* 3 Clean Outcome Pills */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl glass border border-white/5">
              <div className="text-amber-400 font-extrabold text-xl num">-41.2%</div>
              <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider num">Fake Reach Cut</div>
            </div>
            <div className="p-3 rounded-xl glass border border-white/5">
              <div className="text-emerald-400 font-extrabold text-xl num">₹18.4M</div>
              <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider num">Budget Saved</div>
            </div>
            <div className="p-3 rounded-xl glass border border-white/5">
              <div className="text-cyan-300 font-extrabold text-xl num">Instant</div>
              <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider num">ROI Forecast</div>
            </div>
          </div>
        </ScrollReveal>

        {/* Right Column: Interactive Audit Preview */}
        <ScrollReveal className="lg:col-span-6" y={32} delay={150} duration={950}>
          <SpotlightCard className="p-7 relative border border-white/10 glass rounded-3xl overflow-hidden shadow-2xl">
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${isXRay ? 'opacity-[0.14]' : 'opacity-[0.04]'
                }`}
            >
              <img
                src="/brands/nykaa-editorial.webp"
                alt=""
                className="size-full object-cover object-right grayscale contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-[#050811]/55" />
            </div>

            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[90px] pointer-events-none transition-colors duration-700 ${isXRay ? 'bg-cyan-500/15' : 'bg-rose-500/10'}`} />

            {/* Card Header */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className={`size-2.5 rounded-full ${isXRay ? 'bg-cyan-400 shadow-[0_0_10px_#00F0FF]' : 'bg-slate-500'}`} />
                <span className="num text-xs font-bold tracking-widest text-white uppercase">
                  {isXRay ? 'VERIFIED AUDIT VIEW' : 'UNVERIFIED DECK VIEW'}
                </span>
              </div>

              {/* Toggle Controls */}
              <div className="flex items-center p-1 rounded-full bg-white/[0.04] border border-white/10">
                <button
                  type="button"
                  onClick={() => handleToggle(false)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-300 ${!isXRay ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Raw View
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(true)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-300 flex items-center gap-1.5 ${isXRay ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_16px_rgba(0,240,255,0.4)]' : 'text-slate-400 hover:text-white'}`}
                >
                  <span>Verified View</span>
                  <span className="size-1.5 rounded-full bg-slate-950 animate-ping" />
                </button>
              </div>
            </div>

            {/* Profile Meta Header */}
            <div className="relative z-10 flex items-center justify-between py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full overflow-hidden border-2 border-cyan-400/50 shrink-0">
                  <img
                    src="/brands/nykaa-editorial.webp"
                    alt="Creator Benchmark"
                    className="size-full object-cover object-top"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Ria Sharma</span>
                    <span className="num text-[10px] text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">Verified Creator</span>
                  </div>
                  <div className="text-xs text-slate-400 num">Beauty &amp; Skincare · YouTube &amp; Shorts</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10">
                <NykaaLogo className="h-3.5" />
                <span className="num text-[10px] text-slate-300 font-semibold">Linked</span>
              </div>
            </div>

            {/* Scanline Effect when in Verified mode */}
            {isXRay && (
              <motion.div
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ repeat: Infinity, duration: 2.8, ease: 'linear' }}
                className="absolute inset-x-0 h-1 pointer-events-none z-20"
                style={{
                  background: 'linear-gradient(90deg, transparent, #00F0FF, transparent)',
                  boxShadow: '0 0 14px 2px rgba(0, 240, 255, 0.6)'
                }}
              />
            )}

            {/* Stats Breakdown List */}
            <div className="relative z-10 divide-y divide-white/5 mt-2">
              {(isXRay ? xrayStats : rawStats).map((item, idx) => (
                <div key={idx} className="py-4 flex items-center justify-between group">
                  <div className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    {item.label}
                  </div>
                  <div className={`text-right font-extrabold text-lg sm:text-xl num ${item.color}`}>
                    <CipherNumber key={`${isXRay}-${item.label}`} value={item.value} ms={200} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Summary Bar */}
            <div className="relative z-10 mt-5 p-3.5 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between">
              <span className="num text-xs text-slate-400">
                Status:{' '}
                <strong className={isXRay ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                  {isXRay ? '✓ RECOMMENDED FOR CAMPAIGN' : '⚠ UNVERIFIED ESTIMATE'}
                </strong>
              </span>
              <span className="num text-xs text-cyan-300">
                Fit: {isXRay ? 'High' : 'Low'}
              </span>
            </div>
          </SpotlightCard>
        </ScrollReveal>
      </div>
    </section>
  )
}
