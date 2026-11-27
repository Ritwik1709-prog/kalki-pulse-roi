'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  AtSignIcon,
  Building2,
  Check,
  ChevronLeftIcon,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import KalkiPulseLogo from './KalkiPulseLogo'
import { NykaaLogo, PurplleLogo, TiraLogo } from './PartnerLogos'
import { useAuth, UserRole } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

type AuthMode = 'signin' | 'signup'
type SubmitStage = 'idle' | 'verifying' | 'opening' | 'granted'

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: 'Brand Marketer', value: 'Brand Marketer' },
  { label: 'Data Scientist', value: 'Data Scientist' },
  { label: 'Agency', value: 'Agency Lead' },
]

function evaluatePasswordStrength(pw: string): {
  score: number
  label: string
  color: string
} {
  if (!pw) return { score: 0, label: 'Awaiting Input', color: '#64748B' }
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

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, signup, isAuthenticated } = useAuth()

  const intendedDestination =
    (location.state as { from?: string } | null)?.from || '/dashboard'

  const [mode, setMode] = useState<AuthMode>('signin')
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

  const switchMode = (next: AuthMode) => {
    if (next === mode || submitStage !== 'idle') return
    setErrorMsg(null)
    setMode(next)
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
      setErrorMsg('Password must be at least 8 characters.')
      return
    }

    setSubmitStage('verifying')
    const openTimer = window.setTimeout(() => {
      setSubmitStage((prev) => (prev === 'verifying' ? 'opening' : prev))
    }, 300)

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

      window.clearTimeout(openTimer)
      setSubmitStage('opening')
      await new Promise((r) => window.setTimeout(r, 220))
      setSubmitStage('granted')
      await new Promise((r) => window.setTimeout(r, 380))
      navigate(intendedDestination, { replace: true })
    } catch (err) {
      window.clearTimeout(openTimer)
      setSubmitStage('idle')
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.')
    }
  }

  const submitLabel = (() => {
    if (submitStage === 'verifying') return 'Verifying Credentials...'
    if (submitStage === 'opening') return 'Opening Workspace...'
    if (submitStage === 'granted') return 'Access Granted'
    return mode === 'signin' ? 'Sign In' : 'Create Workspace'
  })()

  return (
    <main className="relative min-h-screen bg-[#030306] text-white lg:grid lg:grid-cols-2">
      {/* ========================================================= */}
      {/* LEFT PANEL: ANIMATED FLOATING PATHS + KALKI PULSE BRAND   */}
      {/* ========================================================= */}
      <aside className="bg-[#070a12]/70 relative hidden min-h-screen flex-col justify-between border-r border-white/[0.08] p-10 lg:flex overflow-hidden">
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        {/* Soft bottom-to-top atmospheric scrim */}
        <div
          aria-hidden
          className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-[#030306] via-[#030306]/45 to-transparent"
        />

        {/* Top-left Logo */}
        <div className="relative z-20 flex items-center justify-between">
          <KalkiPulseLogo onClick={() => navigate('/')} />
          <span className="num text-[10px] tracking-[0.22em] text-cyan-300/80 uppercase px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
            Workspace Access
          </span>
        </div>

        {/* Bottom Editorial Quote + Supported Channels */}
        <div className="relative z-20 mt-auto space-y-6 max-w-lg">
          <blockquote className="space-y-3">
            <p className="font-maison text-2xl xl:text-[28px] leading-snug text-white/95">
              &ldquo;Know every creator&apos;s true commercial impact and forecast campaign revenue before you spend a rupee.&rdquo;
            </p>
            <footer className="num text-xs font-medium tracking-wider text-slate-400">
              — KALKI PULSE • YOUTUBE &amp; SHORTS ROI INTELLIGENCE
            </footer>
          </blockquote>

          <div className="pt-5 border-t border-white/10 flex items-center justify-between gap-4">
            <span className="num text-[10px] tracking-[0.2em] text-slate-400 uppercase">
              Trusted Benchmarks
            </span>
            <div className="flex items-center gap-4 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08]">
              <NykaaLogo className="h-3.5" />
              <TiraLogo className="h-3" />
              <PurplleLogo className="h-3.5" />
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT PANEL: CLEAN SHADCN + KALKI AUTH FLOW               */}
      {/* ========================================================= */}
      <section className="relative flex min-h-screen flex-col justify-center px-5 py-20 sm:px-8 lg:px-12 overflow-y-auto">
        {/* Subtle Ambient Cyan Glow */}
        <div
          aria-hidden
          className="absolute inset-0 isolate -z-10 pointer-events-none overflow-hidden"
        >
          <div
            className="absolute -top-36 right-0 h-[520px] w-[520px] rounded-full opacity-50 blur-[120px]"
            style={{
              background:
                'radial-gradient(circle, rgba(0,240,255,0.12) 0%, rgba(56,189,248,0.04) 55%, transparent 80%)',
            }}
          />
          <div
            className="absolute -bottom-32 -left-24 h-[420px] w-[420px] rounded-full opacity-40 blur-[120px]"
            style={{
              background:
                'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 75%)',
            }}
          />
        </div>

        {/* Top-left Home Back Button */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/')}
          className="absolute top-6 left-5 sm:left-8 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-full px-3.5"
        >
          <ChevronLeftIcon className="size-4 me-1.5" />
          Home
        </Button>

        {/* Auth Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[420px] space-y-6"
        >
          {/* Mobile Logo */}
          <div className="flex items-center lg:hidden">
            <KalkiPulseLogo onClick={() => navigate('/')} />
          </div>

          {/* Segmented Mode Toggle (Sign In / Create Account) */}
          <div
            role="tablist"
            aria-label="Authentication Mode"
            className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.04] border border-white/10"
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
                  className={cn(
                    'relative py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors duration-200',
                    active ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="authTabIndicator"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] shadow-[0_0_20px_rgba(0,240,255,0.28)]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Header */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-1.5"
            >
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {mode === 'signin' ? 'Sign in to KALKI Pulse' : 'Create your workspace'}
              </h1>
              <p className="text-sm text-slate-400">
                {mode === 'signin'
                  ? 'Access creator audits, live YouTube tracking, and ROI forecasts.'
                  : 'Set up your brand workspace and start forecasting campaign ROI.'}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* 1-Click Demo Credentials Fill (Sign In mode) */}
          {mode === 'signin' && (
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full px-3.5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-[#00F0FF]/30 hover:border-[#00F0FF]/65 text-left flex items-center justify-between gap-2 transition-all duration-200 group"
            >
              <span className="flex items-center gap-2 num text-xs font-semibold text-[#00F0FF]">
                <Zap className="size-3.5 shrink-0" />
                <span>Use Demo Account (demo@kalkisaas.com)</span>
              </span>
              <span className="num text-[10px] text-slate-400 group-hover:text-white transition-colors">
                AUTO
              </span>
            </button>
          )}

          {/* Error Alert */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="p-3 rounded-xl bg-[#FF2A85]/12 border border-[#FF2A85]/40 text-rose-200 text-xs flex items-start gap-2.5"
              >
                <AlertTriangle className="size-4 text-[#FF2A85] shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-300">
                        Full Name
                      </span>
                      <div className="relative">
                        <User className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="text"
                          required={mode === 'signup'}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Aarav Mehta"
                          className="ps-9 h-11 bg-[#070a12]/80 border-white/12 text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-[#00F0FF]/50 focus-visible:border-[#00F0FF]"
                        />
                      </div>
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-300">
                        Brand / Company
                      </span>
                      <div className="relative">
                        <Building2 className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="text"
                          required={mode === 'signup'}
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="Nykaa, Tira, KALKI"
                          className="ps-9 h-11 bg-[#070a12]/80 border-white/12 text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-[#00F0FF]/50 focus-visible:border-[#00F0FF]"
                        />
                      </div>
                    </label>
                  </div>

                  {/* Role Selector */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-300 block">
                      Workspace Role
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#070a12]/80 border border-white/12">
                      {ROLE_OPTIONS.map((opt) => {
                        const selected = role === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRole(opt.value)}
                            className={cn(
                              'relative py-2 px-2 rounded-lg text-xs font-medium transition-colors',
                              selected ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                            )}
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
              <span className="text-xs font-medium text-slate-300">
                Work Email
              </span>
              <div className="relative">
                <AtSignIcon className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="ps-9 h-11 bg-[#070a12]/80 border-white/12 text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-[#00F0FF]/50 focus-visible:border-[#00F0FF]"
                />
              </div>
            </label>

            {/* Password */}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">
                Password
              </span>
              <div className="relative">
                <Lock className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••••••'}
                  className="ps-9 pe-10 h-11 bg-[#070a12]/80 border-white/12 text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-[#00F0FF]/50 focus-visible:border-[#00F0FF]"
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

            {/* Password Strength Bar (Sign Up only) */}
            {mode === 'signup' && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between num text-[11px]">
                  <span className="text-slate-400">Password Strength</span>
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

            {/* Primary Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={submitStage !== 'idle'}
              className={cn(
                'w-full h-11 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 mt-1',
                submitStage === 'granted'
                  ? 'bg-[#10B981] text-slate-950 hover:bg-[#10B981] shadow-[0_0_24px_rgba(16,185,129,0.45)]'
                  : 'bg-white text-slate-950 hover:bg-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.22)]'
              )}
            >
              {submitStage === 'granted' ? (
                <>
                  <Check className="size-4 me-2 stroke-[3]" />
                  <span>{submitLabel}</span>
                </>
              ) : submitStage !== 'idle' ? (
                <>
                  <Sparkles className="size-4 me-2 animate-spin" />
                  <span>{submitLabel}</span>
                </>
              ) : (
                <>
                  <span>{submitLabel}</span>
                  <ArrowRight className="size-4 ms-2" />
                </>
              )}
            </Button>
          </form>

          {/* Footer & Security Info */}
          <div className="pt-2 space-y-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between num text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[#10B981]" />
                Encrypted Brand Session
              </span>
              <span>60m Session TTL</span>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed">
              By continuing, you agree to our{' '}
              <a
                href="#terms"
                onClick={(e) => e.preventDefault()}
                className="text-slate-300 hover:text-[#00F0FF] underline underline-offset-4 transition-colors"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="#privacy"
                onClick={(e) => e.preventDefault()}
                className="text-slate-300 hover:text-[#00F0FF] underline underline-offset-4 transition-colors"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </motion.div>
      </section>
    </main>
  )
}

function FloatingPaths({ position }: { position: number }) {
  const paths = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
          380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
          152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
          684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
        duration: 20 + ((i * 7) % 10),
        opacity: 0.06 + i * 0.015,
      })),
    [position]
  )

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="h-full w-full text-[#00F0FF]"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={path.opacity}
            strokeDasharray="240 160"
            initial={{ strokeDashoffset: 400 }}
            animate={{
              strokeDashoffset: [400, 0, -400],
              opacity: [0.3, 0.75, 0.3],
            }}
            transition={{
              duration: path.duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  )
}
