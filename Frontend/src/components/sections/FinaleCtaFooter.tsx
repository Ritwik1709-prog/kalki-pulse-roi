import React from 'react'
import { useNavigate } from 'react-router-dom'
import MagneticButton from '../ui/MagneticButton'
import KalkiPulseLogo from '../ui/KalkiPulseLogo'
import ScrollReveal from '../ui/ScrollReveal'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../ui/PartnerLogos'

export default function FinaleCtaFooter() {
  const nav = useNavigate()

  return (
    <>
      {/* ========================================================= */}
      {/* SUBSCRIPTION FINALE CTA                                  */}
      {/* ========================================================= */}
      <section className="relative px-6 md:px-16 py-32 overflow-hidden border-t border-white/[0.06]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-indigo-500/10 rounded-full blur-[160px] pointer-events-none" />

        <ScrollReveal y={28} duration={950}>
        <div className="max-w-5xl mx-auto glass p-10 md:p-20 text-center relative rounded-3xl border border-white/10 shadow-2xl">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-cyan-400/30 text-cyan-300 mb-6">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              GET STARTED
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold max-w-3xl mx-auto tracking-tight leading-[1.08] text-white">
            Predict Exact ROI <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400">
              Before Spending a Rupee.
            </span>
          </h2>

          <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed font-normal">
            Subscribe to KALKI Pulse to evaluate creators, filter fake reach, and forecast revenue with confidence.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-10 relative z-10">
            <MagneticButton onClick={() => nav('/auth')}>
              Start Your Subscription →
            </MagneticButton>
          </div>

          {/* Supported Channels Bar */}
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap items-center justify-center gap-6 num text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-semibold">CREATOR ROI INTELLIGENCE</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-3">
              <span>BUILT FOR</span>
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
                <NykaaLogo className="h-3.5" />
                <span className="text-slate-600">·</span>
                <TiraLogo className="h-3" />
                <span className="text-slate-600">·</span>
                <PurplleLogo className="h-3.5" />
              </div>
            </div>
          </div>
        </div>
        </ScrollReveal>
      </section>

      {/* ========================================================= */}
      {/* FOOTER                                                   */}
      {/* ========================================================= */}
      <footer className="px-6 md:px-16 pt-16 pb-12 bg-[#020306] border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 pb-14 border-b border-white/[0.06]">
          {/* Col 1: Brand Anchor */}
          <div className="col-span-2 space-y-4">
            <KalkiPulseLogo />
            <p className="text-slate-400 text-xs max-w-sm leading-relaxed mt-4">
              Creator ROI intelligence built for modern D2C and beauty brands.
            </p>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-3">
            <div className="num text-xs font-bold tracking-widest text-white uppercase">
              Platform
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#purpose" className="hover:text-cyan-300 transition-colors">Creator Audit</a></li>
              <li><a href="#goals" className="hover:text-cyan-300 transition-colors">ROI Simulator</a></li>
              <li><a href="#benefits" className="hover:text-cyan-300 transition-colors">Benefits</a></li>
              <li><a href="#pricing" className="hover:text-cyan-300 transition-colors">Pricing</a></li>
              <li><a onClick={() => nav('/auth')} className="hover:text-cyan-300 cursor-pointer transition-colors">Sign In</a></li>
            </ul>
          </div>

          {/* Col 3: Channels */}
          <div className="space-y-3">
            <div className="num text-xs font-bold tracking-widest text-white uppercase">
              Channels
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><span className="text-white font-medium">Nykaa</span></li>
              <li><span className="text-white font-medium">Reliance Tira</span></li>
              <li><span className="text-white font-medium">Purplle</span></li>
              <li><span className="text-white font-medium">Direct Storefront</span></li>
            </ul>
          </div>

          {/* Col 4: Solutions */}
          <div className="space-y-3">
            <div className="num text-xs font-bold tracking-widest text-white uppercase">
              Solutions
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><span>Creator Discovery</span></li>
              <li><span>Audience Verification</span></li>
              <li><span>Revenue Forecasting</span></li>
              <li><span>Campaign Analytics</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Micro-Bar */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 num">
          <div>
            © 2026 KALKI PULSE. ALL RIGHTS RESERVED.
          </div>
          <div className="flex gap-6">
            <span className="hover:text-slate-400 cursor-pointer">PRIVACY</span>
            <span className="hover:text-slate-400 cursor-pointer">TERMS</span>
            <span className="hover:text-slate-400 cursor-pointer">SECURITY</span>
          </div>
        </div>
      </footer>
    </>
  )
}
