import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MagneticButton from '../ui/MagneticButton'
import KalkiPulseLogo from '../ui/KalkiPulseLogo'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../ui/PartnerLogos'

export default function FinaleCtaFooter() {
  const nav = useNavigate()
  const [tip, setTip] = useState(false)

  return (
    <>
      {/* ========================================================= */}
      {/* ENTERPRISE COMMAND CENTER FINALE CTA                     */}
      {/* ========================================================= */}
      <section className="relative px-6 md:px-16 py-32 overflow-hidden border-t border-white/[0.06]">
        {/* Ambient radial aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-indigo-500/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="max-w-5xl mx-auto glass p-10 md:p-20 text-center relative rounded-3xl border border-white/10 shadow-2xl">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-cyan-400/30 text-cyan-300 mb-6">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              04 // ENTERPRISE DEPLOYMENT
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold max-w-3xl mx-auto tracking-tight leading-[1.08] text-white">
            Engineer Exact ROI <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400">
              Before Spending a Rupee.
            </span>
          </h2>

          <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed font-normal">
            Join enterprise growth teams and modern D2C beauty leaders who calibrate creator campaigns across Nykaa, Tira &amp; Purplle with sub-5ms mathematical certainty.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-10 relative z-10">
            <MagneticButton onClick={() => nav('/auth')}>
              Launch Enterprise Predictor →
            </MagneticButton>

            <div
              onMouseEnter={() => setTip(true)}
              onMouseLeave={() => setTip(false)}
              onFocus={() => setTip(true)}
              onBlur={() => setTip(false)}
              className="relative"
            >
              <MagneticButton primary={false} onClick={() => nav('/data-pipeline')}>
                Inspect Data Pipeline Lab
              </MagneticButton>

              {tip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 glass px-4 py-2 num text-[11px] text-cyan-300 rounded-xl whitespace-nowrap border border-cyan-400/30 shadow-xl z-20">
                  ⚡ Pre-configured test credentials loaded in sandbox
                </div>
              )}
            </div>
          </div>

          {/* Live System SLA Badge with Official Partner Logos */}
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap items-center justify-center gap-6 num text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-semibold">ALL SYSTEMS NOMINAL</span>
            </div>
            <span>•</span>
            <span>ONNX RUNTIME v1.18.0</span>
            <span>•</span>
            <span>AVG SLA: 4.1MS</span>
            <span>•</span>
            <div className="flex items-center gap-3">
              <span>CALIBRATED FOR</span>
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
      </section>

      {/* ========================================================= */}
      {/* SWISS TECH ARCHITECTURAL FOOTER                          */}
      {/* ========================================================= */}
      <footer className="px-6 md:px-16 pt-16 pb-12 bg-[#020306] border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 pb-14 border-b border-white/[0.06]">
          {/* Col 1: Brand Anchor */}
          <div className="col-span-2 space-y-4">
            <KalkiPulseLogo />
            <p className="text-slate-400 text-xs max-w-sm leading-relaxed mt-4">
              High-frequency AI decision engine for deterministic influencer marketing. Calibrated with real-world conversion baselines from India&apos;s leading beauty commerce platforms.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="px-3 py-1.5 rounded-lg glass border border-white/5 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="num text-[10px] text-slate-300">Model Inference Ready</span>
              </div>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-3">
            <div className="num text-xs font-bold tracking-widest text-white uppercase">
              Platform
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#goals" className="hover:text-cyan-300 transition-colors">ROI Predictor</a></li>
              <li><a href="#purpose" className="hover:text-cyan-300 transition-colors">X-Ray Scanner</a></li>
              <li><a onClick={() => nav('/data-pipeline')} className="hover:text-cyan-300 cursor-pointer transition-colors">Data Cleaning Lab</a></li>
              <li><a href="#benefits" className="hover:text-cyan-300 transition-colors">ONNX Benchmarks</a></li>
            </ul>
          </div>

          {/* Col 3: Calibrations */}
          <div className="space-y-3">
            <div className="num text-xs font-bold tracking-widest text-white uppercase">
              Calibrations
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><span className="text-white font-medium">Nykaa Beauty</span> (1.18×)</li>
              <li><span className="text-white font-medium">Reliance Tira</span> (1.05×)</li>
              <li><span className="text-white font-medium">Purplle D2C</span> (0.94×)</li>
              <li><span className="text-white font-medium">Direct Web</span> (0.88×)</li>
            </ul>
          </div>

          {/* Col 4: Architecture */}
          <div className="space-y-3">
            <div className="num text-xs font-bold tracking-widest text-white uppercase">
              Technology
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><span>Apache Kafka Streams</span></li>
              <li><span>Redis In-Memory Velocity</span></li>
              <li><span>XGBoost + LightGBM</span></li>
              <li><span>SHAP Game-Theoretic Proofs</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Micro-Bar */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 num">
          <div>
            © 2026 KALKI SAAS INC. DETERMINISTIC INFLUENCER INTEL.
          </div>
          <div className="flex gap-6">
            <span className="hover:text-slate-400 cursor-pointer">PRIVACY SPEC</span>
            <span className="hover:text-slate-400 cursor-pointer">MODEL CARD v2.4</span>
            <span className="hover:text-slate-400 cursor-pointer">SOC2 COMPLIANCE</span>
          </div>
        </div>
      </footer>
    </>
  )
}
