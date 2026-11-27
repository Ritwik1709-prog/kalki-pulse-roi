'use client'

import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NumberFlow from '@number-flow/react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCheck,
  CreditCard,
  Landmark,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from './card'
import { TimelineContent } from './timeline-animation'

interface PlanSpec {
  name: string
  description: string
  price: number
  yearlyPrice: number
  buttonText: string
  popular?: boolean
  features: Array<{ text: string; icon: React.ReactNode }>
  includes: string[]
}

const PLANS: PlanSpec[] = [
  {
    name: 'Starter',
    description:
      'Ideal for emerging D2C brands validating creator campaigns before scaling.',
    price: 4999,
    yearlyPrice: 47990,
    buttonText: 'Choose Starter',
    features: [
      { text: 'Up to 15 creator audits / month', icon: <Users className="size-4 text-cyan-300" /> },
      { text: 'Live YouTube & Shorts tracking', icon: <TrendingUp className="size-4 text-cyan-300" /> },
      { text: 'Pre-spend revenue & ROI forecasts', icon: <BarChart3 className="size-4 text-cyan-300" /> },
    ],
    includes: [
      'Included with Starter:',
      'Verified reach screening',
      'Buyer intent signals',
      'Campaign summary exports',
    ],
  },
  {
    name: 'Growth',
    description:
      'Best value for growing beauty & D2C teams running multi-creator launches.',
    price: 14999,
    yearlyPrice: 143990,
    buttonText: 'Choose Growth',
    popular: true,
    features: [
      { text: 'Up to 100 creator audits / month', icon: <Users className="size-4 text-[#00F0FF]" /> },
      { text: 'Nykaa, Tira & Purplle benchmarks', icon: <Sparkles className="size-4 text-[#00F0FF]" /> },
      { text: 'Unlimited ROI campaign simulations', icon: <BarChart3 className="size-4 text-[#00F0FF]" /> },
    ],
    includes: [
      'Everything in Starter, plus:',
      'Fake engagement protection',
      'Multi-creator comparisons',
      'Priority workspace support',
    ],
  },
  {
    name: 'Enterprise',
    description:
      'Built for high-budget brands and agencies managing continuous creator rosters.',
    price: 39999,
    yearlyPrice: 383990,
    buttonText: 'Choose Enterprise',
    features: [
      { text: 'Unlimited creator audits', icon: <Users className="size-4 text-emerald-400" /> },
      { text: 'Unlimited team seats & workspaces', icon: <Building2 className="size-4 text-emerald-400" /> },
      { text: 'Custom retail channel baselines', icon: <ShieldCheck className="size-4 text-emerald-400" /> },
    ],
    includes: [
      'Everything in Growth, plus:',
      'Dedicated account strategist',
      'Enterprise security controls',
      'Executive ROI briefings',
    ],
  },
]

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI / QR', icon: Smartphone, hint: 'Instant GPay, PhonePe & BHIM' },
  { id: 'card', label: 'Corporate Card', icon: CreditCard, hint: 'Visa, Mastercard & RuPay' },
  { id: 'netbanking', label: 'NetBanking', icon: Landmark, hint: 'All major Indian banks' },
] as const

const PricingSwitch = ({ onSwitch }: { onSwitch: (value: string) => void }) => {
  const [selected, setSelected] = useState('0')

  const handleSwitch = (value: string) => {
    setSelected(value)
    onSwitch(value)
  }

  return (
    <div className="flex justify-center">
      <div className="relative z-20 mx-auto flex w-fit rounded-full bg-[#070a12]/90 border border-white/10 p-1 backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleSwitch('0')}
          className={`relative z-10 w-fit sm:h-11 h-10 rounded-full sm:px-6 px-4 py-2 text-sm font-semibold transition-colors ${
            selected === '0' ? 'text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          {selected === '0' && (
            <motion.span
              layoutId="pricingSwitch"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] shadow-[0_0_20px_rgba(0,240,255,0.35)]"
              transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            />
          )}
          <span className="relative z-10">Monthly</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitch('1')}
          className={`relative z-10 w-fit sm:h-11 h-10 flex-shrink-0 rounded-full sm:px-6 px-4 py-2 text-sm font-semibold transition-colors ${
            selected === '1' ? 'text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          {selected === '1' && (
            <motion.span
              layoutId="pricingSwitch"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] shadow-[0_0_20px_rgba(0,240,255,0.35)]"
              transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <span>Yearly</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold num ${
                selected === '1'
                  ? 'bg-slate-950/15 text-slate-950'
                  : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
              }`}
            >
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

export function PricingSection() {
  const navigate = useNavigate()
  const [isYearly, setIsYearly] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<PlanSpec | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi')
  const pricingRef = useRef<HTMLElement>(null)

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
    hidden: {
      y: 22,
      opacity: 0,
    },
  }

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value, 10) === 1)

  const activeAmount = checkoutPlan
    ? isYearly
      ? checkoutPlan.yearlyPrice
      : checkoutPlan.price
    : 0
  const gstAmount = Math.round(activeAmount * 0.18)
  const totalAmount = activeAmount + gstAmount

  const handleProceedToCheckout = () => {
    if (!checkoutPlan) return
    const selectedPlan = checkoutPlan.name
    setCheckoutPlan(null)
    navigate('/auth', {
      state: {
        selectedPlan,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        paymentMethod,
      },
    })
  }

  return (
    <section
      id="pricing"
      ref={pricingRef}
      className="relative px-6 md:px-16 py-32 overflow-hidden border-t border-white/[0.06]"
    >
      {/* Ambient Radial Aura */}
      <div
        aria-hidden
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[780px] h-[420px] rounded-full blur-[150px] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(0, 240, 255, 0.10) 0%, rgba(16, 185, 129, 0.05) 55%, transparent 80%)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass border border-cyan-400/30 text-cyan-300 mb-5"
          >
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="num text-[11px] font-semibold tracking-[0.22em] uppercase">
              SUBSCRIPTION &amp; CHECKOUT
            </span>
          </TimelineContent>

          <TimelineContent
            as="h2"
            animationNum={1}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-white mb-4"
          >
            Plans that work best for your{' '}
            <TimelineContent
              as="span"
              animationNum={2}
              timelineRef={pricingRef}
              customVariants={revealVariants}
              className="border border-dashed border-[#00F0FF]/60 px-3 py-0.5 rounded-xl bg-cyan-500/10 text-[#00F0FF] capitalize inline-block"
            >
              brand
            </TimelineContent>
          </TimelineContent>

          <TimelineContent
            as="p"
            animationNum={3}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed"
          >
            Choose a subscription tier to unlock creator audits, fake reach protection, and pre-spend revenue forecasts.
          </TimelineContent>
        </div>

        {/* Billing Cycle Toggle */}
        <TimelineContent
          as="div"
          animationNum={4}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="mb-10"
        >
          <PricingSwitch onSwitch={togglePricingPeriod} />
        </TimelineContent>

        {/* 3 Subscription Tiers */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan, index) => (
            <TimelineContent
              key={plan.name}
              as="div"
              animationNum={5 + index}
              timelineRef={pricingRef}
              customVariants={revealVariants}
              className="flex"
            >
              <Card
                className={`relative w-full flex flex-col justify-between rounded-3xl transition-all duration-300 ${
                  plan.popular
                    ? 'border-[#00F0FF]/55 ring-1 ring-[#00F0FF]/45 bg-[#08101c]/90 shadow-[0_0_50px_rgba(0,240,255,0.12)]'
                    : 'border-white/10 bg-[#070a12]/80 hover:border-white/25'
                } backdrop-blur-xl`}
              >
                <CardHeader className="text-left pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      {plan.name}
                    </h3>
                    {plan.popular && (
                      <span className="bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] text-slate-950 px-3 py-1 rounded-full text-xs font-bold tracking-wide num">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 pt-1 min-h-[42px]">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline pt-4">
                    <span className="text-4xl font-extrabold text-white num flex items-baseline">
                      ₹
                      <NumberFlow
                        value={isYearly ? plan.yearlyPrice : plan.price}
                        className="text-4xl font-extrabold text-white num"
                      />
                    </span>
                    <span className="text-slate-400 text-sm ml-1.5 num">
                      /{isYearly ? 'year' : 'month'}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="pt-2 flex-1 flex flex-col justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan(plan)}
                      className={`w-full mb-6 py-3.5 px-5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] text-slate-950 shadow-[0_0_24px_rgba(0,240,255,0.35)] hover:brightness-110'
                          : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/15'
                      }`}
                    >
                      <span>{plan.buttonText}</span>
                      <ArrowRight className="size-4" />
                    </button>

                    <ul className="space-y-3 py-4 border-t border-white/[0.07]">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-3">
                          <span className="size-7 rounded-lg bg-white/[0.05] border border-white/10 grid place-content-center shrink-0">
                            {feature.icon}
                          </span>
                          <span className="text-sm text-slate-200 font-medium">
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3 pt-5 mt-2 border-t border-white/[0.07]">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-400 num">
                      {plan.includes[0]}
                    </h4>
                    <ul className="space-y-2.5">
                      {plan.includes.slice(1).map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-center gap-3">
                          <span className="size-5 bg-[#10B981]/15 border border-[#10B981]/40 rounded-full grid place-content-center shrink-0">
                            <CheckCheck className="size-3 text-[#10B981]" />
                          </span>
                          <span className="text-sm text-slate-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TimelineContent>
          ))}
        </div>
      </div>

      {/* Interactive Subscription Payment Gateway Modal */}
      <AnimatePresence>
        {checkoutPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCheckoutPlan(null)}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-[#070b14] border border-white/15 p-6 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="num text-[10px] tracking-[0.2em] uppercase text-[#00F0FF]">
                    SUBSCRIPTION CHECKOUT
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {checkoutPlan.name} Plan
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isYearly ? 'Annual Billing (20% Discount Applied)' : 'Monthly Subscription'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close checkout"
                  onClick={() => setCheckoutPlan(null)}
                  className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-300 block">
                  Select Payment Method
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon
                    const active = paymentMethod === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-[#00F0FF]/12 border-[#00F0FF]/60 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:border-white/25'
                        }`}
                      >
                        <Icon className={`size-4 mb-1.5 ${active ? 'text-[#00F0FF]' : ''}`} />
                        <div className="text-xs font-semibold">{m.label}</div>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-slate-400">
                  {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.hint}
                </p>
              </div>

              {/* Order Summary */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>
                    KALKI Pulse {checkoutPlan.name} ({isYearly ? 'Yearly' : 'Monthly'})
                  </span>
                  <span className="num font-semibold">
                    ₹{activeAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>GST (18%)</span>
                  <span className="num">₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2.5 border-t border-white/10 flex justify-between items-baseline text-sm">
                  <span className="font-semibold text-white">Total Due</span>
                  <span className="num text-lg font-extrabold text-[#10B981]">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#38BDF8] text-slate-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(0,240,255,0.3)] hover:brightness-110 transition-all"
              >
                <span>Proceed to Workspace &amp; Activate</span>
                <ArrowRight className="size-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 num">
                <Lock className="size-3 text-[#10B981]" />
                <span>256-bit Encrypted Checkout • Cancel Anytime</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default PricingSection
