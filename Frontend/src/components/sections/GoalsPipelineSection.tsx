import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SpotlightCard from '../ui/SpotlightCard'
import CipherNumber from '../ui/CipherNumber'
import MagneticButton from '../ui/MagneticButton'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../ui/PartnerLogos'

const STAGES = [
  {
    num: '01',
    title: 'Multi-Source Ingestion',
    sub: 'Nykaa · Tira · Purplle',
    desc: 'Unifies historical partner sales lakes with live Apache Kafka Protobuf streams. Schema normalization, median imputation, and IQR bot-outlier removal.',
    tag: 'APACHE KAFKA',
    color: '#00F0FF'
  },
  {
    num: '02',
    title: 'Feature Velocity Engine',
    sub: 'Sliding Windows (<1ms)',
    desc: 'Real-time engagement derivatives (likes/min, velocity slopes) and NLP buyer-intent scoring cached in Redis cluster memory.',
    tag: 'REDIS FEATURE STORE',
    color: '#EF4444'
  },
  {
    num: '03',
    title: 'ONNX + XGBoost Scoring',
    sub: 'Sub-5ms Inference SLA',
    desc: 'Compiled tree ensembles predict precise click-through rate, cart additions, and conversion probabilities without neural bloat.',
    tag: 'ONNX RUNTIME',
    color: '#10B981'
  },
  {
    num: '04',
    title: 'Financial Yield Arbitrage',
    sub: 'Deterministic Net ROI',
    desc: 'Converts probabilities into expected Gross Revenue, Cost-per-Order, and Net ROI = ((Revenue − Budget) / Budget) × 100 in ₹.',
    tag: 'DECISION ENGINE',
    color: '#F59E0B'
  }
]

interface ChannelConfig {
  multiplier: number
  color: string
  aov: number
  category: string
  photo?: string
  photoPos?: string
  photoCaption: string
  logo?: React.ReactNode
}

const CHANNELS: Record<string, ChannelConfig> = {
  Nykaa: {
    multiplier: 1.18,
    color: '#FC2779',
    aov: 1450,
    category: 'Skincare & Luxe Beauty',
    photo: '/brands/nykaa-editorial.webp',
    photoPos: 'object-top',
    photoCaption: 'NYKAA LUXE // SKINCARE GRAPH CALIBRATED',
    logo: <NykaaLogo className="h-4" />
  },
  Tira: {
    multiplier: 1.05,
    color: '#ED1C24',
    aov: 2800,
    category: 'Flagship Omnichannel Prestige',
    photo: '/brands/tira-store-hero.webp',
    photoPos: 'object-center',
    photoCaption: 'RELIANCE TIRA // JIO WORLD BENCHMARK',
    logo: <TiraLogo className="h-3.5" />
  },
  Purplle: {
    multiplier: 0.94,
    color: '#C084FC',
    aov: 980,
    category: 'High-Velocity Haircare & Daily',
    photo: '/brands/purplle-campaign.jpg',
    photoPos: 'object-top',
    photoCaption: 'PURPLLE PRO // CAMPAIGN VELOCITY CURVE',
    logo: <PurplleLogo className="h-4" />
  },
  'D2C Web': {
    multiplier: 0.88,
    color: '#00F0FF',
    aov: 1200,
    category: 'Direct Storefront Checkout',
    photoCaption: 'DIRECT D2C // SHOPIFY & CUSTOM PIXEL'
  }
}

export default function GoalsPipelineSection() {
  const nav = useNavigate()
  const [budget, setBudget] = useState(300000)
  const [channel, setChannel] = useState('Nykaa')
  const [velocity, setVelocity] = useState(50)

  const activeChannel = CHANNELS[channel]
  const visits = Math.round((budget / 8.5) * (0.5 + velocity / 100))
  const conv = Math.round(visits * 0.024 * activeChannel.multiplier)
  const rev = Math.round(conv * activeChannel.aov)
  const roi = ((rev - budget) / budget) * 100
  const formatINR = (n: number) => '₹' + n.toLocaleString('en-IN')

  return (
    <section id="goals" className="relative px-6 md:px-16 py-32 overflow-hidden border-t border-white/[0.06]">
      {/* Background glow */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass border border-emerald-400/30 text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              02 // ARCHITECTURE &amp; PIPELINE
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Deterministic Intelligence <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              in 4 Hardware Stages.
            </span>
          </h2>
          <p className="text-slate-300 text-base md:text-lg font-normal">
            Every influencer campaign is scored against calibrated historical datasets from Indian beauty commerce platforms. Zero black-box guesswork.
          </p>
        </div>

        {/* 4 Pipeline Stages Cards with Connected Bus */}
        <div className="relative grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="hidden lg:block absolute top-[52px] inset-x-8 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 z-0 pointer-events-none" />

          {STAGES.map((stage) => (
            <SpotlightCard
              key={stage.num}
              className="p-6 relative glass rounded-2xl border border-white/10 hover:border-cyan-400/30 transition-all duration-300 flex flex-col justify-between z-10 group"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <span className="num text-xs font-bold tracking-widest text-cyan-300">
                    STAGE // {stage.num}
                  </span>
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: stage.color, boxShadow: `0 0 10px ${stage.color}` }}
                  />
                </div>

                <div className="num text-[10px] text-slate-400 tracking-wider uppercase mt-4">
                  {stage.sub}
                </div>
                <h3 className="text-xl font-bold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                  {stage.title}
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mt-3 font-normal">
                  {stage.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-white/5">
                <span className="num text-[10px] tracking-widest font-semibold text-slate-400 uppercase px-2 py-1 rounded bg-white/[0.04]">
                  {stage.tag}
                </span>
              </div>
            </SpotlightCard>
          ))}
        </div>

        {/* Live Interactive ROI Simulation Cockpit with Morphing Brand Lens */}
        <SpotlightCard className="p-8 md:p-12 relative glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Dynamic Brand Photo Backdrop (Surprises on brand switch) */}
          <AnimatePresence mode="wait">
            {activeChannel.photo && (
              <motion.div
                key={channel}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 0.24, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="absolute inset-0 pointer-events-none"
              >
                <img
                  src={activeChannel.photo}
                  alt={channel}
                  className="size-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-[#050811]/70" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Brand-tinted ambient glow */}
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors duration-700"
            style={{ backgroundColor: `${activeChannel.color}25` }}
          />

          {/* Header Bar */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full animate-pulse"
                  style={{ backgroundColor: activeChannel.color, boxShadow: `0 0 10px ${activeChannel.color}` }}
                />
                <span className="num text-xs font-bold tracking-widest text-cyan-300 uppercase">
                  {activeChannel.photoCaption}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mt-1.5">
                Calibrate Your Influencer Campaign Yield
              </h3>
            </div>

            {/* Clean Real-Logo Platform Selector (Zero duplicate brand text!) */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-full bg-[#070a12]/80 backdrop-blur-md border border-white/10">
              {Object.keys(CHANNELS).map((name) => {
                const conf = CHANNELS[name]
                const isSelected = channel === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setChannel(name)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-semibold tracking-wider transition-all duration-300 ${
                      isSelected
                        ? 'bg-white/[0.12] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: conf.color,
                            boxShadow: `0 0 18px ${conf.color}45`,
                            borderWidth: 1
                          }
                        : { borderWidth: 1, borderColor: 'transparent' }
                    }
                  >
                    {conf.logo ? (
                      conf.logo
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-cyan-400" />
                        <span>{name}</span>
                      </span>
                    )}
                    <span className="num text-[10px] text-slate-300/90 font-bold">
                      {conf.multiplier}×
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interactive Dials & Results Matrix */}
          <div className="relative z-10 grid lg:grid-cols-12 gap-10 mt-8 items-center">
            {/* Left 6 Columns: Sliders + Brand Editorial Preview Card */}
            <div className="lg:col-span-6 space-y-5">
              {/* Brand Live Lens Preview Strip */}
              {activeChannel.photo && (
                <div className="relative h-28 rounded-2xl overflow-hidden border border-white/15 flex items-end p-4 group">
                  <img
                    src={activeChannel.photo}
                    alt={`${channel} Storefront`}
                    className={`absolute inset-0 size-full object-cover ${activeChannel.photoPos ?? 'object-center'} group-hover:scale-105 transition-transform duration-700`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-[#050811]/60 to-transparent" />
                  <div className="relative z-10 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="px-2.5 py-1 rounded-lg bg-[#050811]/75 backdrop-blur-md border border-white/10">
                        {activeChannel.logo}
                      </div>
                      <span className="num text-[10.5px] text-slate-200 font-semibold">
                        {activeChannel.category}
                      </span>
                    </div>
                    <span
                      className="num text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#050811]/80 border"
                      style={{ color: activeChannel.color, borderColor: `${activeChannel.color}55` }}
                    >
                      AOV {formatINR(activeChannel.aov)}
                    </span>
                  </div>
                </div>
              )}

              {/* Slider 1: Budget */}
              <div className="space-y-3 p-5 rounded-2xl bg-[#070a12]/70 backdrop-blur-md border border-white/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-300">Campaign Allocation Budget</span>
                  <span className="num font-extrabold text-xl text-white">
                    {formatINR(budget)}
                  </span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={1000000}
                  step={10000}
                  value={budget}
                  onChange={(e) => setBudget(+e.target.value)}
                  className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between num text-[10px] text-slate-400">
                  <span>₹50,000 (Micro)</span>
                  <span>₹5,00,000 (Mid-Market)</span>
                  <span>₹10,00,000+ (Enterprise)</span>
                </div>
              </div>

              {/* Slider 2: Velocity */}
              <div className="space-y-3 p-5 rounded-2xl bg-[#070a12]/70 backdrop-blur-md border border-white/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-300">Social Engagement Velocity</span>
                  <span className="num font-extrabold text-xl text-cyan-300">
                    {velocity} <span className="text-xs text-slate-400">evt/sec</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={velocity}
                  onChange={(e) => setVelocity(+e.target.value)}
                  className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between num text-[10px] text-slate-400">
                  <span>Slow Burn (10 evt/s)</span>
                  <span>Moderate Traction</span>
                  <span>Viral Breakthrough (100 evt/s)</span>
                </div>
              </div>
            </div>

            {/* Right 6 Columns: Financial Yield Display */}
            <div className="lg:col-span-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#070a12]/80 backdrop-blur-md border border-white/10">
                  <div className="num text-[11px] text-slate-400 uppercase tracking-wider">
                    Forecast Store Visits
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 num">
                    <CipherNumber value={visits.toLocaleString('en-IN')} ms={200} />
                  </div>
                  <div className="num text-[10px] text-slate-400 mt-1">High Intent Clicks</div>
                </div>

                <div className="p-5 rounded-2xl bg-[#070a12]/80 backdrop-blur-md border border-white/10">
                  <div className="num text-[11px] text-slate-400 uppercase tracking-wider">
                    Predicted Orders ({channel})
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-cyan-300 mt-1 num">
                    <CipherNumber value={conv.toLocaleString('en-IN')} ms={200} />
                  </div>
                  <div className="num text-[10px] text-slate-400 mt-1">
                    At {activeChannel.multiplier}× Multiplier
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#070a12]/80 backdrop-blur-md border border-white/10">
                  <div className="num text-[11px] text-slate-400 uppercase tracking-wider">
                    Projected Gross Revenue
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 num">
                    <CipherNumber value={formatINR(rev)} ms={250} />
                  </div>
                  <div className="num text-[10px] text-slate-400 mt-1">Verified Basket Value</div>
                </div>

                <div className="p-5 rounded-2xl bg-[#070a12]/80 backdrop-blur-md border border-white/10">
                  <div className="num text-[11px] text-slate-400 uppercase tracking-wider">
                    Deterministic Net ROI
                  </div>
                  <div
                    className={`text-2xl sm:text-3xl font-extrabold mt-1 num ${
                      roi >= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    <CipherNumber
                      value={(roi >= 0 ? '+' : '') + roi.toFixed(1) + '%'}
                      ms={250}
                    />
                  </div>
                  <div className="num text-[10px] text-emerald-400/80 mt-1">
                    Net Profit Yield
                  </div>
                </div>
              </div>

              {/* Sparkline & Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 num text-xs text-slate-300">
                  <svg viewBox="0 0 80 20" className="w-20 h-5">
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                      points="0,18 20,14 40,15 60,6 80,2"
                    />
                  </svg>
                  <span>99.2% ONNX Predictive Fit</span>
                </div>

                <MagneticButton onClick={() => nav('/auth')}>
                  Launch Full Model Cockpit →
                </MagneticButton>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  )
}
