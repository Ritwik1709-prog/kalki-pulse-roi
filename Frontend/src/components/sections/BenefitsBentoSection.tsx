import React from 'react'
import { useNavigate } from 'react-router-dom'
import SpotlightCard from '../ui/SpotlightCard'
import ScrollReveal from '../ui/ScrollReveal'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../ui/PartnerLogos'

const MetricBar = ({
  label,
  value,
  color = '#00F0FF',
  detail
}: {
  label: string
  value: number
  color?: string
  detail?: string
}) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-300 font-medium">{label}</span>
      <span className="num font-bold text-white">{detail || `${value}%`}</span>
    </div>
    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden p-0.5 border border-white/5">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${value}%`,
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}80`
        }}
      />
    </div>
  </div>
)

const BEAUTY_TRIAD = [
  {
    id: 'nykaa',
    logo: <NykaaLogo className="h-4" />,
    photo: '/brands/nykaa-editorial.webp',
    pos: 'object-top',
    category: 'Skincare & Luxe',
    aov: '₹1,450 AOV',
    accent: '#FC2779'
  },
  {
    id: 'tira',
    logo: <TiraLogo className="h-4" />,
    photo: '/brands/tira-store-hero.webp',
    pos: 'object-center',
    category: 'Luxury Makeup',
    aov: '₹2,800 AOV',
    accent: '#E5C483'
  },
  {
    id: 'purplle',
    logo: <PurplleLogo className="h-4" />,
    photo: '/brands/purplle-campaign.jpg',
    pos: 'object-top',
    category: 'Haircare & Daily',
    aov: '₹980 AOV',
    accent: '#C084FC'
  }
]

export default function BenefitsBentoSection() {
  const nav = useNavigate()

  return (
    <section id="benefits" className="relative px-6 md:px-16 py-32 overflow-hidden border-t border-white/[0.06]">
      <div className="absolute bottom-10 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-14">
        {/* Section Header */}
        <ScrollReveal className="max-w-3xl space-y-4" y={24} duration={900}>
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass border border-sky-400/30 text-sky-300">
            <span className="size-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              PLATFORM BENEFITS
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Built to Be Trusted <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400">
              With Serious Budgets.
            </span>
          </h2>
          <p className="text-slate-300 text-base md:text-lg font-normal">
            Replace guesswork with clear creator audits, real-time sales forecasts, and transparent campaign outcomes.
          </p>
        </ScrollReveal>

        {/* Bento Grid */}
        <ScrollReveal y={28} delay={120} duration={950}>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Card 1: Speed */}
          <SpotlightCard className="md:col-span-2 p-7 glass rounded-3xl border border-white/10 flex flex-col justify-between min-h-[260px] group">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="num text-xs font-bold tracking-widest text-cyan-300">
                  REAL-TIME DECISIONS
                </span>
                <span className="num text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                  INSTANT
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mt-3 group-hover:text-cyan-300 transition-colors">
                Evaluate Any Creator in Seconds
              </h3>
              <p className="text-slate-300 text-xs mt-1">
                Go from a YouTube handle or campaign brief to a complete conversion and ROI forecast without manual spreadsheets.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <MetricBar
                label="Manual Agency Audit"
                value={100}
                color="#F59E0B"
                detail="3–5 Days"
              />
              <MetricBar
                label="KALKI Pulse Forecast"
                value={6}
                color="#00F0FF"
                detail="Instant"
              />
            </div>
          </SpotlightCard>

          {/* Card 2: Marketplace Benchmarks */}
          <SpotlightCard className="md:col-span-2 p-7 glass rounded-3xl border border-white/10 flex flex-col justify-between min-h-[260px] group">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="num text-xs font-bold tracking-widest text-[#FC2779]">
                  COMMERCE READY
                </span>
                <span className="num text-[11px] text-slate-300 font-semibold">
                  BEAUTY &amp; D2C
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mt-3 group-hover:text-cyan-300 transition-colors">
                Channel-Tailored Benchmarks
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3.5 pt-4">
              {BEAUTY_TRIAD.map((brand) => (
                <div
                  key={brand.id}
                  className="relative h-40 rounded-2xl overflow-hidden border border-white/15 group/card cursor-pointer"
                >
                  <img
                    src={brand.photo}
                    alt={brand.id}
                    className={`absolute inset-0 size-full object-cover ${brand.pos} group-hover/card:scale-110 transition-transform duration-700`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#04060d] via-[#04060d]/65 to-[#04060d]/25" />

                  <div
                    className="absolute top-2 right-2 size-2 border-t border-r opacity-75"
                    style={{ borderColor: brand.accent }}
                  />
                  <div
                    className="absolute bottom-2 left-2 size-2 border-b border-l opacity-75"
                    style={{ borderColor: brand.accent }}
                  />

                  <div className="relative z-10 h-full p-3 flex flex-col justify-between">
                    <div className="inline-flex self-start px-2 py-1 rounded-md bg-[#050811]/75 backdrop-blur-md border border-white/10">
                      {brand.logo}
                    </div>

                    <div>
                      <div
                        className="num text-xs font-bold"
                        style={{ color: brand.accent }}
                      >
                        {brand.aov}
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium truncate mt-0.5">
                        {brand.category}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Card 3: Bot Protection */}
          <SpotlightCard className="p-6 glass rounded-3xl border border-white/10 flex flex-col justify-between min-h-[240px] group">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="num text-xs font-bold tracking-widest text-amber-400">
                  AUDIENCE SHIELD
                </span>
                <span className="num text-[10px] text-slate-400">VERIFIED</span>
              </div>
              <h3 className="text-lg font-bold text-white mt-2 group-hover:text-cyan-300 transition-colors">
                Fake Engagement Protection
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Flags artificial traffic spikes and low-quality engagement before you commit campaign budget.
              </p>
            </div>

            <div className="py-2">
              <svg viewBox="0 0 100 36" className="w-full h-12 overflow-visible">
                <path
                  d="M 0 34 Q 30 34 40 18 Q 50 2 60 18 Q 70 34 100 34"
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="2"
                />
                <rect x="74" y="0" width="26" height="36" fill="#F59E0B" opacity="0.25" rx="3" />
                <line x1="74" y1="0" x2="74" y2="36" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" />
              </svg>
              <div className="flex justify-between num text-[9.5px] text-slate-500 mt-1">
                <span>Organic Baseline</span>
                <span className="text-amber-400 font-semibold">Anomaly Flagged</span>
              </div>
            </div>
          </SpotlightCard>

          {/* Card 4: Clear ROI Drivers */}
          <SpotlightCard className="md:col-span-2 p-7 glass rounded-3xl border border-white/10 flex flex-col justify-between min-h-[240px] group">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="num text-xs font-bold tracking-widest text-emerald-400">
                  TRANSPARENT INSIGHTS
                </span>
                <span className="num text-[11px] text-slate-400">CAMPAIGN DRIVERS</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-3 group-hover:text-cyan-300 transition-colors">
                Understand What Drives Every Sale
              </h3>
              <p className="text-slate-300 text-xs mt-1">
                See which audience signals contribute most to projected store visits, conversions, and net return.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3">
              <MetricBar label="Audience Reach Quality" value={34} color="#00F0FF" detail="High" />
              <MetricBar label="Buyer Purchase Intent" value={28} color="#FF2A85" detail="Strong" />
              <MetricBar label="Category Alignment" value={22} color="#10B981" detail="Verified" />
              <MetricBar label="Product Price Fit" value={16} color="#E5C483" detail="Optimal" />
            </div>
          </SpotlightCard>

          {/* Card 5: Subscription Access */}
          <SpotlightCard className="p-6 glass rounded-3xl border border-white/10 flex flex-col justify-between min-h-[240px] group">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="num text-xs font-bold tracking-widest text-indigo-400">
                  BRAND WORKSPACE
                </span>
                <span className="size-2 rounded-full bg-indigo-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white mt-2 group-hover:text-cyan-300 transition-colors">
                All-in-One ROI Cockpit
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Compare creators, forecast conversions, and track campaign returns from one subscription.
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => nav('/auth')}
                className="w-full py-2.5 px-4 rounded-xl glass border border-cyan-400/30 text-cyan-300 hover:text-white hover:border-cyan-400 text-xs font-semibold tracking-wider flex items-center justify-center gap-2 transition-all duration-300"
              >
                <span>Start Subscription</span>
                <span>→</span>
              </button>
            </div>
          </SpotlightCard>
        </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
