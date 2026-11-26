import React, { useState } from 'react'
import { motion } from 'framer-motion'
import CipherNumber from '../ui/CipherNumber'
import SpotlightCard from '../ui/SpotlightCard'
import { NykaaLogo } from '../ui/PartnerLogos'

export default function PurposeXRaySection({ onToggle }: { onToggle: () => void }) {
  const [isXRay, setIsXRay] = useState(true)

  const rawStats = [
    { label: 'Reported Followers', value: '850,000', note: 'Unverified self-reported agency stat', color: 'text-white' },
    { label: 'Passive Reel Likes', value: '45,200', note: 'Includes non-buying clickfarm accounts', color: 'text-white' },
    { label: 'Agency Stated Fit', value: '99% Perfect Match', note: 'Subjective qualitative claim', color: 'text-white' },
    { label: 'Forecasted Impressions', value: '1.2M Views', note: 'Zero correlation with checkout cart', color: 'text-white' },
    { label: 'Reported Campaign ROI', value: 'Estimated 5×', note: 'Calculated purely on CPM vanity views', color: 'text-amber-400' }
  ]

  const xrayStats = [
    { label: 'Verified Human Reach', value: '142,500', note: '-83.2% inactive & bot clusters pruned by IQR', color: 'text-cyan-300' },
    { label: 'NLP Commercial Intent', value: '0.88 Score', note: 'High buyer sentiment in Nykaa Skincare', color: 'text-cyan-300' },
    { label: 'Nykaa Audience Overlap', value: '88.4%', note: 'Calibrated against 1,400+ beauty campaigns', color: 'text-[#FC2779]' },
    { label: 'Predicted Checkout Orders', value: '259 Orders', note: 'Sub-5ms ONNX conversion inference', color: 'text-emerald-400' },
    { label: 'Deterministic Net ROI', value: '+210.8%', note: 'Exact net yield: ((₹3.75L Rev − Cost) / Cost)', color: 'text-emerald-400' }
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
        {/* Left Column: Analytical Copy */}
        <div className="lg:col-span-6 space-y-7">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass border border-cyan-400/30 text-cyan-300">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              01 // THE DIAGNOSTIC AUDIT
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
            Indian beauty and D2C brands waste up to <strong className="text-white font-semibold">41.8% of creator budgets</strong> on inflated follower counts, passive double-taps, and dead-weight likes that never convert to a checkout cart on Nykaa or Tira.
          </p>

          {/* Industry quote badge */}
          <div className="p-5 rounded-2xl glass border border-white/10 relative overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 to-emerald-400" />
            <p className="text-sm italic text-slate-200 leading-snug">
              &ldquo;Likes are vanity. Conversions are sanity. Real-time cash flow is deterministic reality.&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-3 num text-[11px] text-slate-400">
              <span>Nykaa · Tira · Purplle Cross-Marketplace Calibration Audit</span>
            </div>
          </div>

          {/* 3 Metric Pills */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl glass border border-white/5">
              <div className="text-amber-400 font-extrabold text-xl num">-41.2%</div>
              <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider num">Bot Anomaly Drop</div>
            </div>
            <div className="p-3 rounded-xl glass border border-white/5">
              <div className="text-emerald-400 font-extrabold text-xl num">₹18.4M</div>
              <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider num">Waste Prevented</div>
            </div>
            <div className="p-3 rounded-xl glass border border-white/5">
              <div className="text-cyan-300 font-extrabold text-xl num">&lt;50ms</div>
              <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider num">ONNX Audit Latency</div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive X-Ray Terminal */}
        <div className="lg:col-span-6">
          <SpotlightCard className="p-7 relative border border-white/10 glass rounded-3xl overflow-hidden shadow-2xl">
            {/* Subtle real brand campaign backdrop revealed during X-Ray */}
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

            {/* Ambient Corner Glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[90px] pointer-events-none transition-colors duration-700 ${isXRay ? 'bg-cyan-500/15' : 'bg-rose-500/10'}`} />

            {/* Terminal Header */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className={`size-2.5 rounded-full ${isXRay ? 'bg-cyan-400 shadow-[0_0_10px_#00F0FF]' : 'bg-slate-500'}`} />
                <span className="num text-xs font-bold tracking-widest text-white uppercase">
                  {isXRay ? 'AI TELEMETRY X-RAY ACTIVE' : 'RAW AGENCY DECK VIEW'}
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
                  <span>X-Ray Lens</span>
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
                  <div className="text-xs text-slate-400 num">Beauty &amp; Skincare Niche · Instagram + YouTube</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10">
                <NykaaLogo className="h-3.5" />
                <span className="num text-[10px] text-slate-300 font-semibold">Linked</span>
              </div>
            </div>

            {/* Scanline Effect when in X-Ray mode */}
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
                <div key={idx} className="py-3.5 flex items-center justify-between group">
                  <div>
                    <div className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {item.note}
                    </div>
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
                  {isXRay ? '✓ APPROVED FOR NYKAA BUDGET' : '⚠ UNVERIFIED ESTIMATE'}
                </strong>
              </span>
              <span className="num text-xs text-cyan-300">
                Confidence: {isXRay ? '94.6%' : '18.0%'}
              </span>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  )
}
