import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Building2,
  Zap,
} from 'lucide-react'
import KalkiPulseLogo from '../components/ui/KalkiPulseLogo'
import SpotlightCard from '../components/ui/SpotlightCard'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../components/ui/PartnerLogos'
import { useAuth, UserRole } from '../context/AuthContext'

type AuthMode = 'signin' | 'signup'
type SubmitStage = 'idle' | 'hashing' | 'issuing' | 'granted'

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: 'Brand Marketer', value: 'Brand Marketer' },
  { label: 'Data Scientist', value: 'Data Scientist' },
  { label: 'Agency', value: 'Agency Lead' },
]

const TELEMETRY_FEED = [
  { label: 'ARGON2 HANDSHAKE READY', status: 'OK', color: '#10B981' },
  { label: 'REDIS FEATURE STORE: 0.8ms', status: 'LIVE', color: '#00F0FF' },
  { label: 'ONNX XGBOOST ENGINE: STANDBY', status: 'ARMED', color: '#38BDF8' },
  { label: 'HISTORICAL BASELINES: NYKAA • TIRA • PURPLLE', status: 'SYNCED', color: '#FF2A85' },
]

function evaluatePasswordStrength(pw: string): {
  score: number
  label: string
  color: string
} {
  if (!pw) return { score: 0, label: 'Awaiting Input', color: '#475569' }
  let points = 0
  if (pw.length >= 8) points += 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) points += 1
  if (/\d/.test(pw)) points += 1
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 10) points += 1

  const clamped = Math.max(1, Math.min(4, points))
  if (clamped === 1) return { score: 1, label: 'Weak', color: '#FF2A85' }
  if (clamped === 2) return { score: 2, label: 'Fair', color: '#F59E0B' }
  if (clamped === 3) return { score: 3, label: 'Good', color: '#00F0FF' }
  return { score: 4, label: 'Strong', color: '#10B981' }
}

const INPUT_CLASS =
  'w-full rounded-xl bg-[#070a12]/80 border border-white/10 px-10 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-[#00F0FF] focus:shadow-[0_0_0_3px_rgba(0,240,255,0.16)]'

export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, signup, isAuthenticated } = useAuth()

  const intendedDestination =
    (location.state as { from?: string } | null)?.from || '/dashboard'

  const [mode, setMode] = useState<AuthMode>('signin')
  const [headerGlitch, setHeaderGlitch] = useState(false)
  const [activeFeedIdx, setActiveFeedIdx] = useState(0)

  // Shared & mode-specific form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [role, setRole] = useState<UserRole>('Brand Marketer')

  const [submitStage, setSubmitStage] = useState<SubmitStage>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const strength = useMemo(() => evaluatePasswordStrength(password), [password])

  // Redirect already-authenticated visitors unless mid-success transition
  useEffect(() => {
    if (isAuthenticated && submitStage === 'idle') {
      navigate(intendedDestination, { replace: true })
    }
  }, [isAuthenticated, submitStage, navigate, intendedDestination])

  // Cycle live telemetry feed line highlights
  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveFeedIdx((prev) => (prev + 1) % TELEMETRY_FEED.length)
    }, 1800)
    return () => window.clearInterval(id)
  }, [])

  const switchMode = (next: AuthMode) => {
    if (next === mode || submitStage !== 'idle') return
    setErrorMsg(null)
    setMode(next)
    setHeaderGlitch(true)
    window.setTimeout(() => setHeaderGlitch(false), 160)
  }

  const fillDemoCredentials = () => {
    if (mode !== 'signin') {
      switchMode('signin')
    }
    setErrorMsg(null)
    setEmail('demo@kalkisaas.com')
    setPassword('KalkiPulse2026!')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitStage !== 'idle') return
    setErrorMsg(null)

    if (mode === 'signup' && password.length < 8) {
      setErrorMsg('Password must be at least 8 characters for Argon2 vault protection.')
      return
    }

    setSubmitStage('hashing')
    const issueTimer = window.setTimeout(() => {
      setSubmitStage((prev) => (prev === 'hashing' ? 'issuing' : prev))
    }, 320)

    try {
      if (mode === 'signin') {
        await login(email.trim(), password)
      } else {
        await signup({
          full_name: fullName.trim(),
          brand_name: brandName.trim(),
          role,
          email: email.trim(),
          password,
        })
      }

      window.clearTimeout(issueTimer)
      setSubmitStage('issuing')
      await new Promise((r) => window.setTimeout(r, 240))
      setSubmitStage('granted')
      await new Promise((r) => window.setTimeout(r, 420))
      navigate(intendedDestination, { replace: true })
    } catch (err) {
      window.clearTimeout(issueTimer)
      setSubmitStage('idle')
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.')
    }
  }

  const submitLabel = (() => {
    if (submitStage === 'hashing') return 'VERIFYING ARGON2 HASH...'
    if (submitStage === 'issuing') return 'ISSUING JWT TOKEN...'
    if (submitStage === 'granted') return 'ACCESS GRANTED'
    return mode === 'signin' ? 'Authenticate' : 'Initialize Workspace'
  })()

  return (
    <div className="min-h-screen bg-[#030306] text-white flex flex-col lg:flex-row relative">
      {/* ========================================================= */}
      {/* LEFT PANEL (52%): LIVE TELEMETRY SHOWCASE                 */}
      {/* ========================================================= */}
      <aside className="relative lg:w-[52%] flex flex-col justify-between p-6 sm:p-8 lg:p-10 gap-6 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/[0.07]">
        {/* Obsidian Dot-Matrix Grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.22) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Volumetric Cyan & Rose Aura */}
        <div
          aria-hidden="true"
          className="absolute -top-28 -left-24 w-[460px] h-[460px] rounded-full bg-[#00F0FF]/12 blur-[140px] pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 right-0 w-[440px] h-[440px] rounded-full bg-[#FF2A85]/12 blur-[150px] pointer-events-none"
        />

        {/* Diagonal Optical Scanline Sweep */}
        <motion.div
          aria-hidden="true"
          initial={{ x: '-120%' }}
          animate={{ x: '220%' }}
          transition={{ repeat: Infinity, duration: 7.5, ease: 'linear' }}
          className="absolute inset-y-0 w-1/2 pointer-events-none"
          style={{
            background:
              'linear-gradient(115deg, transparent 35%, rgba(0, 240, 255, 0.06) 50%, transparent 65%)',
          }}
        />

        {/* Top-Left Brand Lockup (clicks home) */}
        <div className="relative z-10 flex items-center justify-between">
          <KalkiPulseLogo onClick={() => navigate('/')} />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="num text-[11px] text-slate-400 hover:text-[#00F0FF] transition-colors tracking-wider"
          >
            ← OVERVIEW
          </button>
        </div>

        {/* Centerpiece: Floating Frosted-Glass Live Access Terminal */}
        <div className="relative z-10 my-8 lg:my-0">
          <div
            className="rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden"
            style={{
              background: 'rgba(12, 15, 24, 0.65)',
              backdropFilter: 'blur(26px)',
            }}
          >
            {/* Subtle corner reticles */}
            <span className="absolute top-3 left-3 size-2.5 border-t border-l border-[#00F0FF]/60" />
            <span className="absolute bottom-3 right-3 size-2.5 border-b border-r border-[#FF2A85]/60" />

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-cyan-400/25 mb-5">
              <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="num text-[10px] tracking-[0.22em] text-cyan-300 uppercase">
                LIVE ACCESS TERMINAL // GATEWAY v2.0
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.h1
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="text-3xl sm:text-4xl xl:text-[42px] font-extrabold tracking-tight leading-[1.04]"
              >
                {mode === 'signin' ? (
                  <>
                    RESUME TELEMETRY{' '}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00F0FF] to-[#10B981]">
                      ACCESS.
                    </span>
                  </>
                ) : (
                  <>
                    DEPLOY YOUR BRAND{' '}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00F0FF] via-[#38BDF8] to-[#FF2A85]">
                      WORKSPACE.
                    </span>
                  </>
                )}
              </motion.h1>
            </AnimatePresence>

            <p className="text-slate-300/85 text-sm mt-3 max-w-lg leading-relaxed">
              Argon2-hardened session vault protecting real-time ONNX inference, historical conversion curves, and SHAP attribution logs.
            </p>

            {/* Live Simulated System Feed */}
            <div className="mt-6 rounded-2xl bg-[#04060b]/85 border border-white/[0.08] p-4 space-y-2.5">
              {TELEMETRY_FEED.map((item, idx) => {
                const isActive = idx === activeFeedIdx
                return (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between num text-[11px] px-2.5 py-1.5 rounded-lg transition-colors duration-300 ${
                      isActive ? 'bg-white/[0.05] text-white' : 'text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: item.color,
                          boxShadow: isActive ? `0 0 8px ${item.color}` : 'none',
                        }}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span
                      className="text-[10px] font-semibold tracking-wider shrink-0 ml-2"
                      style={{ color: item.color }}
                    >
                      [{item.status}]
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Calibrated Marketplace Logos */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <span className="num text-[10px] text-slate-400 tracking-[0.2em] uppercase">
                CALIBRATED RETAIL GRAPH
              </span>
              <div className="flex items-center gap-4 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <NykaaLogo className="h-3.5" />
                <TiraLogo className="h-3" />
                <PurplleLogo className="h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust Badge */}
        <div className="relative z-10 flex items-center justify-between num text-[10.5px] tracking-[0.22em] text-slate-400 uppercase">
          <span>A KALKI SAAS PRODUCT • ENGINEERED BY KALKI LLP</span>
          <span className="hidden sm:inline text-emerald-400/90">● HS256 + ARGON2</span>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT PANEL (48%): INTERACTIVE GLASS AUTH CONSOLE         */}
      {/* ========================================================= */}
      <main className="lg:w-[48%] flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(0,240,255,0.06),transparent_60%)] pointer-events-none"
        />

        <motion.div
          layout
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[460px] relative z-10"
        >
          <SpotlightCard
            className="p-6 sm:p-8 rounded-3xl border border-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.75)]"
          >
            <div
              className="absolute inset-0 rounded-[inherit] -z-10"
              style={{
                background: 'rgba(12, 15, 24, 0.65)',
                backdropFilter: 'blur(28px)',
              }}
            />

            {/* Segmented Sliding Pill Toggle */}
            <div
              role="tablist"
              aria-label="Authentication Mode"
              className="grid grid-cols-2 p-1 rounded-full bg-[#060912]/90 border border-white/10 mb-6"
            >
              {(
                [
                  { id: 'signin', label: 'Sign In' },
                  { id: 'signup', label: 'Create Account' },
                ] as const
              ).map((tab) => {
                const active = mode === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => switchMode(tab.id)}
                    className={`relative py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-colors duration-200 ${
                      active ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="authTabIndicator"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] shadow-[0_0_20px_rgba(0,240,255,0.35)]"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Header with 150ms Cyan Micro-Glitch on Mode Switch */}
            <div className="mb-5">
              <div className="relative inline-block">
                <h2 className="text-2xl font-extrabold tracking-tight text-white">
                  {mode === 'signin' ? 'Operator Sign In' : 'Initialize Brand Node'}
                </h2>
                {headerGlitch && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 text-2xl font-extrabold tracking-tight text-[#00F0FF] pointer-events-none"
                    style={{
                      transform: 'translateX(-2px)',
                      clipPath: 'inset(18% 0 38% 0)',
                    }}
                  >
                    {mode === 'signin' ? 'Operator Sign In' : 'Initialize Brand Node'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 num">
                {mode === 'signin'
                  ? 'Enter your credentials or launch the pre-seeded demo profile.'
                  : 'Create an encrypted workspace for your growth or data team.'}
              </p>
            </div>

            {/* 1-Click Faculty / Demo Login Quick-Fill Pill */}
            {mode === 'signin' && (
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="w-full mb-5 px-3.5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-[#00F0FF]/35 hover:border-[#00F0FF]/70 text-left flex items-center justify-between gap-2 transition-all duration-200 group"
              >
                <span className="flex items-center gap-2 num text-[11px] font-semibold text-[#00F0FF]">
                  <Zap className="size-3.5 shrink-0" />
                  <span>Fill Demo Credentials (demo@kalkisaas.com)</span>
                </span>
                <span className="num text-[10px] text-slate-400 group-hover:text-white transition-colors">
                  AUTO
                </span>
              </button>
            )}

            {/* Inline Error Banner */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 rounded-xl bg-[#FF2A85]/12 border border-[#FF2A85]/40 text-rose-200 text-xs flex items-start gap-2.5"
                >
                  <AlertTriangle className="size-4 text-[#FF2A85] shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {mode === 'signup' && (
                  <motion.div
                    key="signup-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3.5 overflow-hidden"
                  >
                    {/* Full Name & Brand Name Grid */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                          Full Name
                        </span>
                        <div className="relative">
                          <User className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            required={mode === 'signup'}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Aarav Mehta"
                            className={INPUT_CLASS}
                          />
                        </div>
                      </label>

                      <label className="block space-y-1.5">
                        <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                          Brand / Company
                        </span>
                        <div className="relative">
                          <Building2 className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            required={mode === 'signup'}
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            placeholder="Nykaa, Tira, KALKI"
                            className={INPUT_CLASS}
                          />
                        </div>
                      </label>
                    </div>

                    {/* Role Selector Pill */}
                    <div className="space-y-1.5">
                      <span className="num text-[10px] tracking-wider uppercase text-slate-400 block">
                        Workspace Role
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#070a12]/80 border border-white/10">
                        {ROLE_OPTIONS.map((opt) => {
                          const selected = role === opt.value
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRole(opt.value)}
                              className={`relative py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                                selected ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {selected && (
                                <motion.span
                                  layoutId="rolePillIndicator"
                                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                  className="absolute inset-0 rounded-lg bg-white/10 border border-[#00F0FF]/40"
                                />
                              )}
                              <span className="relative z-10">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Work Email */}
              <label className="block space-y-1.5">
                <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                  Work Email
                </span>
                <div className="relative">
                  <Mail className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={INPUT_CLASS}
                  />
                </div>
              </label>

              {/* Password */}
              <label className="block space-y-1.5">
                <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                  Password
                </span>
                <div className="relative">
                  <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••••••'}
                    className={`${INPUT_CLASS} pr-10`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              {/* Live Password Strength Telemetry Bar (Sign Up only) */}
              {mode === 'signup' && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between num text-[10px]">
                    <span className="text-slate-400 uppercase tracking-wider">
                      Password Telemetry
                    </span>
                    <span className="font-semibold" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((segment) => {
                      const filled = strength.score >= segment
                      return (
                        <div
                          key={segment}
                          className="h-1.5 rounded-full bg-white/10 transition-all duration-300"
                          style={
                            filled
                              ? {
                                  backgroundColor: strength.color,
                                  boxShadow: `0 0 10px ${strength.color}80`,
                                }
                              : undefined
                          }
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tactile Submit CTA with Cipher Handshake State */}
              <button
                type="submit"
                disabled={submitStage !== 'idle'}
                className={`w-full mt-2 py-3 px-5 rounded-full font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden ${
                  submitStage === 'granted'
                    ? 'bg-[#10B981] text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.55)]'
                    : 'bg-white text-slate-950 hover:bg-[#00F0FF] shadow-[0_0_26px_rgba(0,240,255,0.28)]'
                } disabled:cursor-wait`}
              >
                {submitStage === 'granted' ? (
                  <>
                    <Check className="size-4 stroke-[3]" />
                    <span className="num text-xs font-bold tracking-widest">{submitLabel}</span>
                  </>
                ) : submitStage !== 'idle' ? (
                  <>
                    <Sparkles className="size-4 animate-spin" />
                    <span className="num text-xs font-bold tracking-widest">{submitLabel}</span>
                  </>
                ) : (
                  <>
                    <span>{submitLabel}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Security Footer inside Card */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between num text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[#10B981]" />
                Argon2 + HS256 JWT
              </span>
              <span>60m Session TTL</span>
            </div>
          </SpotlightCard>
        </motion.div>
      </main>
    </div>
  )
}
