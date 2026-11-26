import React from 'react'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../ui/PartnerLogos'

interface PlatformPod {
  id: string
  label?: string
  metric: string
  sub: string
  logo?: React.ReactNode
  thumb?: string
  accent: string
}

const PARTNER_PODS: PlatformPod[] = [
  {
    id: 'nykaa',
    metric: '₹1,450 AOV',
    sub: '1.18× Skincare Multiplier',
    logo: <NykaaLogo className="h-4" />,
    thumb: '/brands/nykaa-editorial.webp',
    accent: '#FC2779'
  },
  {
    id: 'tira',
    metric: '1.05× Multiplier',
    sub: 'Luxury Makeup Baseline',
    logo: <TiraLogo className="h-4" />,
    thumb: '/brands/tira-store-hero.webp',
    accent: '#E5C483'
  },
  {
    id: 'purplle',
    metric: '3.82% Conv. Rate',
    sub: '0.94× Haircare Multiplier',
    logo: <PurplleLogo className="h-4" />,
    thumb: '/brands/purplle-campaign.jpg',
    accent: '#C084FC'
  },
  {
    id: 'kafka',
    label: 'APACHE KAFKA',
    metric: '<5ms Ingestion',
    sub: 'Protobuf Stream Validation',
    accent: '#00F0FF'
  },
  {
    id: 'redis',
    label: 'REDIS CLUSTER',
    metric: '0.8ms Lookup',
    sub: 'Sliding Feature Velocity',
    accent: '#EF4444'
  },
  {
    id: 'onnx',
    label: 'ONNX RUNTIME',
    metric: 'Sub-50ms SLA',
    sub: 'XGBoost Hardware Tree Core',
    accent: '#10B981'
  }
]

const QUANT_SIGNALS = [
  'SHAP GAME-THEORETIC ATTRIBUTION ACTIVE',
  'NYKAA CART-CONVERSION CORRELATION: 0.94',
  'IQR BOT-ANOMALY SPIKE PRUNING: -18.4% FLAGGED',
  'TIRA LUXURY BASKET VELOCITY MAPPED',
  'NLP COMMENT BUYER-INTENT VELOCITY: 0.89',
  'PURPLLE D2C HISTORICAL CONVERSION CURVES',
  'REAL-TIME PROTOBUF INGESTION ACTIVE',
  'HARDWARE TENSOR ACCELERATION READY'
]

export default function TelemetryMarquee() {
  return (
    <section className="relative py-14 overflow-hidden border-y border-white/[0.06] bg-[#05070D]/85 backdrop-blur-md">
      {/* Top Section Header Pill */}
      <div className="flex items-center justify-center gap-3 mb-7 px-6">
        <span className="flex size-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="num text-[11px] font-semibold tracking-[0.28em] text-cyan-300 uppercase">
          CALIBRATED WITH REAL D2C BEAUTY COMMERCE TELEMETRY
        </span>
      </div>

      {/* Edge gradient mask */}
      <div
        className="space-y-5"
        style={{
          maskImage:
            'linear-gradient(90deg, transparent 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, transparent 100%)'
        }}
      >
        {/* Row 1: High-End Partner & Platform Pods */}
        <div className="flex w-max space-x-4" style={{ animation: 'mq 45s linear infinite' }}>
          {[...PARTNER_PODS, ...PARTNER_PODS].map((pod, i) => (
            <div
              key={`${pod.id}-${i}`}
              className="flex items-center gap-3.5 px-4 py-2 rounded-full glass border border-white/10 hover:border-cyan-400/40 transition-colors duration-300 group"
            >
              {pod.thumb ? (
                <img
                  src={pod.thumb}
                  alt={pod.id}
                  className="size-8 rounded-full object-cover border border-white/15 shrink-0"
                />
              ) : (
                <span
                  className="size-2.5 rounded-full ml-1 shrink-0"
                  style={{ backgroundColor: pod.accent, boxShadow: `0 0 10px ${pod.accent}` }}
                />
              )}

              {pod.logo ? (
                <div className="flex items-center pr-3 border-r border-white/10">
                  {pod.logo}
                </div>
              ) : (
                <span className="num text-[11px] font-bold tracking-wider text-white group-hover:text-cyan-300 transition-colors pr-3 border-r border-white/10">
                  {pod.label}
                </span>
              )}

              <div className="flex flex-col text-left pr-1">
                <span className="num text-[10px] font-bold text-emerald-400">
                  {pod.metric}
                </span>
                <span className="num text-[9.5px] text-slate-400">
                  {pod.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Mathematical / Architecture Stream */}
        <div
          className="flex w-max space-x-6 text-slate-400"
          style={{ animation: 'mq 55s linear infinite reverse' }}
        >
          {[...QUANT_SIGNALS, ...QUANT_SIGNALS].map((sig, i) => (
            <div key={i} className="flex items-center gap-3 num text-[11.5px] tracking-[0.2em] uppercase">
              <span className="text-cyan-400/60 font-mono">✦</span>
              <span className="hover:text-white transition-colors duration-200">{sig}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
