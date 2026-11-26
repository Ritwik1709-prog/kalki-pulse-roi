import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Download,
  Radio,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import Navbar from '../components/sections/Navbar'
import SpotlightCard from '../components/ui/SpotlightCard'
import CipherNumber from '../components/ui/CipherNumber'
import MagneticButton from '../components/ui/MagneticButton'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../components/ui/PartnerLogos'
import { useAuth } from '../context/AuthContext'

type SocialPlatform = 'YouTube' | 'YouTube Shorts'
type TargetChannel = 'Nykaa' | 'Tira' | 'Purplle' | 'D2C Web'
type ProductCategory = 'Skincare' | 'Makeup' | 'Haircare' | 'Fragrance'
type Currency = 'INR' | 'USD'

interface CreatorHistoryPoint {
  time: string
  likes_per_min: number
  shares_per_min: number
  comments_per_min: number
  views_delta?: number
  sentiment: number
  live_roi_pct?: number
  source_tag?: string
  is_bot_spike?: boolean
}

interface YouTubeComment {
  author: string
  text: string
  likes: number
  published_at: string
}

interface YouTubeChannelSummary {
  handle: string
  channel_title: string
  subscriber_count: number
  channel_view_count: number
  video_count: number
  quota_units_used: number
  latest_videos: Array<{
    video_id: string
    video_title: string
    platform: string
    views: number
    likes: number
    comments_count: number
  }>
}

interface CreatorFeature {
  influencer_id: string
  display_name: string
  platform: SocialPlatform | string
  niche: string
  followers: number
  likes_per_min: number
  comments_per_min: number
  shares_per_min: number
  rolling_sentiment: number
  total_events: number
  bot_anomaly_ratio: number
  history: CreatorHistoryPoint[]
  lookup_latency_ms: number
  store_mode: string
  data_source?: string
  video_id?: string | null
  video_title?: string | null
  channel_title?: string | null
  real_views?: number
  real_likes?: number
  real_comments?: number
  recent_comments?: YouTubeComment[]
}

interface TickerEvent {
  event_id: string
  influencer_id: string
  platform: string
  time_label: string
  likes_delta: number
  shares_delta: number
  estimated_sentiment: number
  is_bot_spike?: boolean
  data_source?: string
  video_id?: string | null
  video_title?: string | null
  latest_comment?: string | null
  real_views?: number | null
  real_likes?: number | null
}

interface AttributionItem {
  driver: string
  pct: number
  color: string
}

interface CrossChannelItem {
  channel: string
  color: string
  net_roi_percent: number
  predicted_conversions: number
  expected_gross_revenue: number
  multiplier: number
}

interface PredictionResult {
  prediction_id?: number
  influencer_id: string
  social_platform: SocialPlatform
  target_channel: TargetChannel
  product_category: ProductCategory
  campaign_budget: number
  product_price: number
  estimated_reach: number
  predicted_ctr_pct: number
  predicted_cvr_pct: number
  store_visits: number
  predicted_conversions: number
  expected_gross_revenue: number
  cpc: number
  net_roi_percent: number
  decision_tier: string
  inference_latency_ms: number
  feature_store_latency_ms: number
  feature_store_mode: string
  live_telemetry: {
    likes_per_min: number
    shares_per_min: number
    rolling_sentiment: number
    bot_anomaly_ratio: number
  }
  attributions: AttributionItem[]
  cross_channel_comparison: CrossChannelItem[]
  created_at?: string
}

interface SavedHistoryRow {
  id: number
  influencer_id: string
  social_platform: string
  target_channel: string
  product_category: string
  campaign_budget: number
  product_price: number
  estimated_reach: number
  predicted_ctr_pct: number
  store_visits: number
  predicted_conversions: number
  expected_gross_revenue: number
  cpc: number
  net_roi_percent: number
  inference_latency_ms: number
  decision_tier: string
  created_at: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000'
const INR_PER_USD = 84.0

const CHANNELS: Array<{ name: TargetChannel; mult: string; color: string; logo?: React.ReactNode }> = [
  { name: 'Nykaa', mult: '1.18×', color: '#FC2779', logo: <NykaaLogo className="h-3.5" /> },
  { name: 'Tira', mult: '1.05×', color: '#ED1C24', logo: <TiraLogo className="h-3" /> },
  { name: 'Purplle', mult: '0.94×', color: '#C084FC', logo: <PurplleLogo className="h-3.5" /> },
  { name: 'D2C Web', mult: '0.88×', color: '#00F0FF' },
]

const PRESETS: Array<{
  label: string
  influencer_id: string
  social_platform: SocialPlatform
  target_channel: TargetChannel
  product_category: ProductCategory
  campaign_budget: number
  product_price: number
}> = [
  {
    label: 'Nykaa Skincare Shorts Launch',
    influencer_id: '@koyal_bhattacharjee_shorts',
    social_platform: 'YouTube Shorts',
    target_channel: 'Nykaa',
    product_category: 'Skincare',
    campaign_budget: 350000,
    product_price: 1450,
  },
  {
    label: 'Tira Luxury Haul (YouTube)',
    influencer_id: '@super_style_yt',
    social_platform: 'YouTube',
    target_channel: 'Tira',
    product_category: 'Fragrance',
    campaign_budget: 500000,
    product_price: 2800,
  },
  {
    label: 'Purplle Everyday Makeup Shorts',
    influencer_id: '@yashita_rai_shorts',
    social_platform: 'YouTube Shorts',
    target_channel: 'Purplle',
    product_category: 'Makeup',
    campaign_budget: 180000,
    product_price: 699,
  },
  {
    label: 'Nykaa Official Serum Shorts',
    influencer_id: '@nykaa_shorts',
    social_platform: 'YouTube Shorts',
    target_channel: 'Nykaa',
    product_category: 'Skincare',
    campaign_budget: 420000,
    product_price: 1299,
  },
]

export default function DashboardPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  // Global display & input state (always stores canonical INR in state; converts on display/input when USD selected)
  const [currency, setCurrency] = useState<Currency>('INR')
  const [influencerId, setInfluencerId] = useState<string>('@koyal_bhattacharjee_shorts')
  const [customHandleMode, setCustomHandleMode] = useState<boolean>(false)
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('YouTube Shorts')
  const [targetChannel, setTargetChannel] = useState<TargetChannel>('Nykaa')
  const [productCategory, setProductCategory] = useState<ProductCategory>('Skincare')
  const [campaignBudgetInr, setCampaignBudgetInr] = useState<number>(350000)
  const [productPriceInr, setProductPriceInr] = useState<number>(1450)

  // Live API states
  const [creators, setCreators] = useState<CreatorFeature[]>([])
  const [ticker, setTicker] = useState<TickerEvent[]>([])
  const [storeMode, setStoreMode] = useState<string>('in_memory_sliding_window')
  const [youtubeLiveActive, setYoutubeLiveActive] = useState<boolean>(false)
  const [ytInput, setYtInput] = useState<string>('')
  const [ytTracking, setYtTracking] = useState<boolean>(false)
  const [ytBannerMsg, setYtBannerMsg] = useState<string | null>(null)
  const [ytChannelSummary, setYtChannelSummary] = useState<YouTubeChannelSummary | null>(null)
  const [liveSeries, setLiveSeries] = useState<CreatorHistoryPoint[]>([])
  const [liveDeltaMeta, setLiveDeltaMeta] = useState<{
    viewsDelta: number
    likesDelta: number
    latestLikesPm: number
    latestSharesPm: number
  }>({ viewsDelta: 0, likesDelta: 0, latestLikesPm: 0, latestSharesPm: 0 })
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [history, setHistory] = useState<SavedHistoryRow[]>([])
  const tickCountRef = useRef<number>(0)

  const [predicting, setPredicting] = useState<boolean>(false)
  const [bursting, setBursting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const formatMoney = useCallback(
    (inrVal: number, decimals = 0) => {
      if (currency === 'USD') {
        const usd = inrVal / INR_PER_USD
        return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      }
      return '₹' + inrVal.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    },
    [currency]
  )

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    }),
    [token]
  )

  const fetchLiveFeed = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/creators/live-feed`, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      setCreators(data.creators || [])
      setTicker(data.ticker || [])
      setStoreMode(data.store_mode || 'in_memory_sliding_window')
      setYoutubeLiveActive(Boolean(data.youtube_live_active))
    } catch {
      // background poll failure handled silently until user triggers action
    }
  }, [token, authHeaders])

  const fetchHistory = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/predictions/history`, { headers: authHeaders })
      if (!res.ok) return
      const rows = (await res.json()) as SavedHistoryRow[]
      setHistory(rows)
    } catch {
      // ignore
    }
  }, [token, authHeaders])

  const runPrediction = useCallback(
    async (overrides?: {
      influencer_id?: string
      social_platform?: SocialPlatform
      target_channel?: TargetChannel
      product_category?: ProductCategory
      campaign_budget?: number
      product_price?: number
      silent?: boolean
      save_to_history?: boolean
    }) => {
      if (!token) return
      const isSilent = Boolean(overrides?.silent)
      if (!isSilent) {
        setPredicting(true)
        setErrorMsg(null)
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/predict-roi`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            influencer_id: overrides?.influencer_id ?? influencerId,
            social_platform: overrides?.social_platform ?? socialPlatform,
            target_channel: overrides?.target_channel ?? targetChannel,
            product_category: overrides?.product_category ?? productCategory,
            campaign_budget: overrides?.campaign_budget ?? campaignBudgetInr,
            product_price: overrides?.product_price ?? productPriceInr,
            duration_days: 14,
            save_to_history: overrides?.save_to_history ?? !isSilent,
          }),
        })
        if (!res.ok) {
          if (!isSilent) {
            const b = await res.json().catch(() => ({}))
            throw new Error(b.detail || `Prediction error (${res.status})`)
          }
          return
        }
        const data = (await res.json()) as PredictionResult
        setPrediction(data)
        if (overrides?.save_to_history ?? !isSilent) {
          fetchHistory()
        }
      } catch (err) {
        if (!isSilent) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to reach ONNX Prediction Engine.')
        }
      } finally {
        if (!isSilent) {
          setPredicting(false)
        }
      }
    },
    [token, authHeaders, influencerId, socialPlatform, targetChannel, productCategory, campaignBudgetInr, productPriceInr, fetchHistory]
  )

  const fetchStreamTelemetry = useCallback(
    async (targetId: string) => {
      if (!token || !targetId) return
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/telemetry/${encodeURIComponent(targetId)}`, {
          headers: authHeaders,
        })
        if (!res.ok) return
        const data = await res.json()
        const series = (data.time_series || []) as CreatorHistoryPoint[]
        if (series.length > 0) {
          setLiveSeries(series.slice(-30))
          const latest = series[series.length - 1]
          const rm = data.rolling_metrics || {}
          setLiveDeltaMeta({
            viewsDelta: Number(rm.latest_delta_views ?? latest.views_delta ?? 0),
            likesDelta: Number(rm.latest_delta_likes ?? latest.likes_per_min ?? 0),
            latestLikesPm: Number(latest.likes_per_min ?? rm.likes_per_min ?? 0),
            latestSharesPm: Number(latest.shares_per_min ?? rm.shares_per_min ?? 0),
          })
        }
        if (data.recent_events) {
          setTicker(data.recent_events)
        }
        if (data.youtube_live_active !== undefined) {
          setYoutubeLiveActive(Boolean(data.youtube_live_active))
        }
        tickCountRef.current += 1
        // Smoothly re-score ONNX Net ROI HUD every 3 ticks (~4.5s) without flooding shortlist history
        if (tickCountRef.current % 3 === 0) {
          runPrediction({ silent: true, save_to_history: false })
        }
      } catch {
        // silent poll resilience
      }
    },
    [token, authHeaders, runPrediction]
  )

  // Initial load + initial ONNX forecast
  useEffect(() => {
    if (!token) return
    fetchLiveFeed()
    fetchHistory()
    runPrediction()
  }, [token]) // initial bootstrap on login

  // 1.5s Live Telemetry Stream Loop (pauses cleanly when browser tab is hidden)
  useEffect(() => {
    if (!token) return
    let intervalId: number | null = null
    let feedCounter = 0

    const tick = () => {
      if (document.hidden) return
      fetchStreamTelemetry(influencerId)
      feedCounter += 1
      if (feedCounter % 3 === 0) {
        fetchLiveFeed()
      }
    }

    const startPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId)
      tick()
      intervalId = window.setInterval(tick, 1500)
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        tick()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (intervalId !== null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [token, influencerId, fetchStreamTelemetry, fetchLiveFeed])

  const handleTriggerBurst = async (burstType: 'viral' | 'bot_spike') => {
    if (!token || bursting) return
    setBursting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/burst`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          influencer_id: influencerId,
          burst_type: burstType,
          platform: socialPlatform,
        }),
      })
      if (res.ok) {
        await fetchLiveFeed()
        await runPrediction()
      }
    } catch {
      setErrorMsg('Failed to emit Protobuf burst packet.')
    } finally {
      setBursting(false)
    }
  }

  const handleTrackYoutubeVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !ytInput.trim() || ytTracking) return
    setYtTracking(true)
    setErrorMsg(null)
    setYtBannerMsg(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/youtube/track`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ video_url_or_id: ytInput.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.detail || `YouTube tracking error (${res.status})`)
      }
      const trackedNiche = body.niche as ProductCategory
      const validCat: ProductCategory =
        trackedNiche === 'Skincare' || trackedNiche === 'Makeup' || trackedNiche === 'Haircare' || trackedNiche === 'Fragrance'
          ? trackedNiche
          : productCategory

      const trackedPlat: SocialPlatform =
        body.platform === 'YouTube Shorts' || body.platform_key === 'youtube_shorts' ? 'YouTube Shorts' : 'YouTube'

      setCustomHandleMode(false)
      setInfluencerId(body.influencer_id)
      setSocialPlatform(trackedPlat)
      setProductCategory(validCat)
      if (body.lookup_type === 'channel_handle') {
        setYtChannelSummary({
          handle: body.handle || body.influencer_id,
          channel_title: body.channel_title,
          subscriber_count: Number(body.subscriber_count || 0),
          channel_view_count: Number(body.channel_view_count || 0),
          video_count: Number(body.video_count || 0),
          quota_units_used: Number(body.quota_units_used || 4),
          latest_videos: body.latest_videos || [],
        })
        setYtBannerMsg(
          `Live @handle Synced (${body.quota_units_used} units): ${body.channel_title} (${Number(
            body.subscriber_count
          ).toLocaleString()} subscribers · Latest ${trackedPlat}: "${body.video_title}")`
        )
      } else {
        setYtChannelSummary(null)
        setYtBannerMsg(
          `Live ${trackedPlat} Synced: "${body.video_title}" (${body.channel_title}) • ${Number(
            body.real_views
          ).toLocaleString()} views, ${Number(body.real_likes).toLocaleString()} likes`
        )
      }
      setYtInput('')
      await fetchLiveFeed()
      await fetchStreamTelemetry(body.influencer_id)
      await runPrediction({
        influencer_id: body.influencer_id,
        social_platform: trackedPlat,
        product_category: validCat,
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch live YouTube feed.')
    } finally {
      setYtTracking(false)
    }
  }

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setCustomHandleMode(false)
    setInfluencerId(p.influencer_id)
    setSocialPlatform(p.social_platform)
    setTargetChannel(p.target_channel)
    setProductCategory(p.product_category)
    setCampaignBudgetInr(p.campaign_budget)
    setProductPriceInr(p.product_price)
    runPrediction({
      influencer_id: p.influencer_id,
      social_platform: p.social_platform,
      target_channel: p.target_channel,
      product_category: p.product_category,
      campaign_budget: p.campaign_budget,
      product_price: p.product_price,
    })
  }

  const activeCreator = useMemo(() => {
    return creators.find((c) => c.influencer_id === influencerId) || creators[0] || null
  }, [creators, influencerId])

  const velocitySeries = useMemo(() => {
    const source = liveSeries.length > 0 ? liveSeries : activeCreator?.history || []
    if (source.length === 0) {
      return [
        { time: '00:00', likes_per_min: 420, shares_per_min: 38, live_roi_pct: 610 },
        { time: '00:02', likes_per_min: 465, shares_per_min: 44, live_roi_pct: 665 },
      ]
    }
    return source.slice(-30).map((h) => ({
      ...h,
      live_roi_pct: h.live_roi_pct ?? Math.round(120 + h.likes_per_min * 1.4),
    }))
  }, [liveSeries, activeCreator])

  const handleExportBrief = () => {
    const payload = {
      workspace: user?.brand_name,
      currency,
      active_forecast: prediction,
      saved_evaluations: history,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kalki_pulse_roi_brief_${influencerId.replace('@', '')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const decisionColors = (() => {
    if (!prediction) return { text: 'text-[#00F0FF]', border: 'border-cyan-400/40', bg: 'bg-cyan-500/10' }
    if (prediction.net_roi_percent >= 80) {
      return { text: 'text-[#10B981]', border: 'border-emerald-400/45', bg: 'bg-emerald-500/12' }
    }
    if (prediction.net_roi_percent >= 0) {
      return { text: 'text-[#00F0FF]', border: 'border-cyan-400/45', bg: 'bg-cyan-500/12' }
    }
    return { text: 'text-[#FF2A85]', border: 'border-[#FF2A85]/45', bg: 'bg-[#FF2A85]/12' }
  })()

  return (
    <div className="min-h-screen bg-[#030306] text-white relative overflow-x-hidden">
      <div className="absolute -top-32 left-1/4 w-[650px] h-[420px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-[500px] h-[420px] bg-[#FF2A85]/8 rounded-full blur-[160px] pointer-events-none" />

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 md:px-10 pt-28 pb-24 relative z-10 space-y-6">
        {/* ========================================================= */}
        {/* 1. TOP TELEMETRY COMMAND HEADER & SCENARIO PRESETS        */}
        {/* ========================================================= */}
        <div className="space-y-4 pb-5 border-b border-white/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="num text-[11px] font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                  KALKI ✦ PULSE / LIVE AI ROI ESTIMATOR
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/35 num text-[10.5px] font-semibold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  ONNX ENGINE ACTIVE • LAST INFERENCE:{' '}
                  {prediction ? `${prediction.inference_latency_ms} ms` : '0.4 ms'}
                </span>
                {youtubeLiveActive && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/12 border border-emerald-400/45 num text-[10.5px] font-bold text-emerald-300 shadow-[0_0_20px_-4px_#10B981]">
                    <span className="size-1.5 rounded-full bg-[#10B981] animate-ping" />
                    YouTube &amp; Shorts: LIVE API v3 • REAL-TIME STREAM
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-2">
                {user?.brand_name || 'Brand'} Predictive ROI Command Console
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Currency Toggle */}
              <div
                role="group"
                aria-label="Currency Toggle"
                className="flex p-1 rounded-full bg-white/[0.05] border border-white/10"
              >
                {(['INR', 'USD'] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`px-3.5 py-1.5 rounded-full num text-xs font-bold transition-colors ${
                      currency === curr
                        ? 'bg-[#00F0FF] text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {curr === 'INR' ? '₹ INR' : '$ USD'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate('/data-pipeline')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/15 hover:border-[#00F0FF]/50 num text-xs font-semibold text-slate-200 hover:text-white transition-colors"
              >
                <Database className="size-3.5 text-[#00F0FF]" />
                <span>Data Cleaning Lab</span>
              </button>
            </div>
          </div>

          {/* 1-Click Scenario Presets Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="num text-[10px] tracking-widest text-slate-400 uppercase mr-1">
              1-CLICK SCENARIOS:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-cyan-500/15 border border-white/10 hover:border-[#00F0FF]/50 text-xs text-slate-200 hover:text-white transition-all duration-200 flex items-center gap-1.5"
              >
                <Sparkles className="size-3 text-[#00F0FF]" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Dynamic Live YouTube @handle OR Video / Shorts URL Lookup Bar */}
          <form
            onSubmit={handleTrackYoutubeVideo}
            className="p-3 rounded-2xl glass border border-emerald-400/35 flex flex-wrap items-center gap-3"
          >
            <div className="flex items-center gap-2 shrink-0">
              <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="num text-[10.5px] font-bold tracking-wider uppercase text-emerald-300">
                Track Live YouTube @handle or Video / Shorts URL
              </span>
            </div>
            <input
              type="text"
              value={ytInput}
              onChange={(e) => setYtInput(e.target.value)}
              placeholder="Enter @handle (e.g. @Nykaa, @SuperPrincessjo) or YouTube/Shorts URL"
              className="flex-1 min-w-[260px] rounded-xl bg-[#070a12] border border-white/15 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#10B981] num"
            />
            <button
              type="submit"
              disabled={ytTracking || !ytInput.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 num text-xs font-bold transition-colors disabled:opacity-45 shrink-0"
            >
              {ytTracking ? 'Fetching YouTube API...' : 'Pull Live Channel / Video →'}
            </button>
            <span className="num text-[10px] text-slate-400">
              @handle: 4 Quota Units · URL: 2 Units
            </span>
          </form>

          {ytBannerMsg && (
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/35 text-emerald-200 num text-xs space-y-2">
              <div>{ytBannerMsg}</div>
              {ytChannelSummary && ytChannelSummary.latest_videos.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase">
                    Latest {ytChannelSummary.latest_videos.length} Uploads ({ytChannelSummary.handle}):
                  </span>
                  {ytChannelSummary.latest_videos.map((v) => (
                    <button
                      key={v.video_id}
                      type="button"
                      onClick={() => setYtInput(`https://www.youtube.com/watch?v=${v.video_id}`)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-emerald-500/15 border border-white/10 text-[10.5px] text-slate-200 truncate max-w-[260px]"
                      title={`${v.video_title} (${v.views.toLocaleString()} views)`}
                    >
                      [{v.platform === 'YouTube Shorts' ? 'Shorts' : 'Video'}] {v.video_title} ·{' '}
                      {v.views.toLocaleString()} views
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#FF2A85]/12 border border-[#FF2A85]/40 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-[#FF2A85] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* MAIN GRID: CONFIG CONSOLE (LEFT) + FORECAST & STREAM      */}
        {/* ========================================================= */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* 2. CAMPAIGN CONFIGURATION CONSOLE (LEFT 5 COLS) */}
          <SpotlightCard className="lg:col-span-5 p-6 glass rounded-3xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="num text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
                  CAMPAIGN CONFIGURATION
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">Creator &amp; Channel Parameters</h2>
              </div>
              <span className="num text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-slate-300">
                {storeMode === 'redis_live' ? '● REDIS' : '● SLIDING WINDOW'}
              </span>
            </div>

            {/* Creator Selector + Custom Handle Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                  Creator Profile
                </span>
                <button
                  type="button"
                  onClick={() => setCustomHandleMode((m) => !m)}
                  className="num text-[10px] text-[#00F0FF] hover:underline"
                >
                  {customHandleMode ? 'Select from Live Feed' : '+ Custom Handle'}
                </button>
              </div>

              {customHandleMode ? (
                <input
                  type="text"
                  value={influencerId}
                  onChange={(e) => setInfluencerId(e.target.value)}
                  placeholder="@creator_handle"
                  className="w-full rounded-xl bg-[#070a12] border border-white/15 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00F0FF]"
                />
              ) : (
                <select
                  aria-label="Creator Profile"
                  value={influencerId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setInfluencerId(nextId)
                    const found = creators.find((c) => c.influencer_id === nextId)
                    if (
                      found &&
                      (found.platform === 'YouTube' || found.platform === 'YouTube Shorts')
                    ) {
                      setSocialPlatform(found.platform)
                    }
                  }}
                  className="w-full rounded-xl bg-[#070a12] border border-white/15 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00F0FF] num"
                >
                  {creators.map((c) => (
                    <option key={c.influencer_id} value={c.influencer_id}>
                      {c.data_source === 'youtube_api_v3' ? '[LIVE YT] ' : ''}
                      {c.influencer_id} · {c.niche} ({(c.followers / 1000).toFixed(0)}K) · Sent {c.rolling_sentiment}
                    </option>
                  ))}
                </select>
              )}

              {activeCreator && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 num text-[11px]">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
                    {(activeCreator.followers / 1000).toFixed(0)}K Followers · {activeCreator.niche}
                  </span>
                  <span className="text-cyan-300 font-semibold">
                    {activeCreator.likes_per_min} likes/min
                  </span>
                </div>
              )}
            </div>

            {/* Social Platform Selector */}
            <div className="space-y-1.5">
              <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                Social Platform
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#070a12] border border-white/10">
                {(['YouTube', 'YouTube Shorts'] as const).map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setSocialPlatform(plat)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                      socialPlatform === plat
                        ? 'bg-[#00F0FF] text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            {/* E-Commerce Target Channel */}
            <div className="space-y-1.5">
              <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                E-Commerce Target Channel
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((ch) => {
                  const selected = targetChannel === ch.name
                  return (
                    <button
                      key={ch.name}
                      type="button"
                      onClick={() => setTargetChannel(ch.name)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        selected
                          ? 'bg-white/[0.09] text-white'
                          : 'bg-[#070a12]/70 border-white/10 text-slate-400 hover:text-white'
                      }`}
                      style={
                        selected
                          ? { borderColor: ch.color, boxShadow: `0 0 16px ${ch.color}35` }
                          : undefined
                      }
                    >
                      <span className="flex items-center">
                        {ch.logo || <span className="text-xs font-bold">{ch.name}</span>}
                      </span>
                      <span className="num text-[10px] font-bold text-emerald-400">
                        {ch.mult}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Product Category */}
            <div className="space-y-1.5">
              <span className="num text-[10px] tracking-wider uppercase text-slate-400">
                Product Category
              </span>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#070a12] border border-white/10">
                {(['Skincare', 'Makeup', 'Haircare', 'Fragrance'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setProductCategory(cat)}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      productCategory === cat
                        ? 'bg-white/15 text-white border border-[#00F0FF]/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget & Product Price Sliders + Numeric Inputs */}
            <div className="space-y-4 pt-1">
              <div className="p-3.5 rounded-2xl bg-[#070a12]/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">Campaign Budget ({currency})</span>
                  <input
                    type="number"
                    min={1000}
                    value={
                      currency === 'USD'
                        ? Math.round(campaignBudgetInr / INR_PER_USD)
                        : campaignBudgetInr
                    }
                    onChange={(e) => {
                      const val = Math.max(100, Number(e.target.value) || 0)
                      setCampaignBudgetInr(currency === 'USD' ? Math.round(val * INR_PER_USD) : val)
                    }}
                    className="w-28 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1 text-right num text-sm font-bold text-white outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <input
                  type="range"
                  min={50000}
                  max={1500000}
                  step={10000}
                  value={Math.min(1500000, campaignBudgetInr)}
                  onChange={(e) => setCampaignBudgetInr(Number(e.target.value))}
                  className="w-full accent-[#00F0FF] cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#070a12]/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">Product Price / AOV ({currency})</span>
                  <input
                    type="number"
                    min={1}
                    value={
                      currency === 'USD'
                        ? Math.round(productPriceInr / INR_PER_USD)
                        : productPriceInr
                    }
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value) || 0)
                      setProductPriceInr(currency === 'USD' ? Math.round(val * INR_PER_USD) : val)
                    }}
                    className="w-28 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1 text-right num text-sm font-bold text-white outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <input
                  type="range"
                  min={250}
                  max={12000}
                  step={50}
                  value={Math.min(12000, productPriceInr)}
                  onChange={(e) => setProductPriceInr(Number(e.target.value))}
                  className="w-full accent-[#10B981] cursor-pointer"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <MagneticButton
                onClick={() => runPrediction()}
                className="w-full justify-center py-3 text-sm"
              >
                {predicting ? 'Running ONNX Inference...' : 'Forecast Campaign ROI →'}
              </MagneticButton>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={bursting}
                  onClick={() => handleTriggerBurst('viral')}
                  className="py-2.5 px-3 rounded-full bg-cyan-500/12 hover:bg-cyan-500/20 border border-[#00F0FF]/40 text-xs font-semibold text-[#00F0FF] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Zap className="size-3.5" />
                  <span>⚡ Simulate Viral Spike</span>
                </button>
                <button
                  type="button"
                  disabled={bursting}
                  onClick={() => handleTriggerBurst('bot_spike')}
                  className="py-2.5 px-3 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/35 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <ShieldAlert className="size-3.5" />
                  <span>Test Bot Filter</span>
                </button>
              </div>
            </div>
          </SpotlightCard>

          {/* RIGHT 7 COLS: EXECUTIVE FINANCIAL HUD + LIVE PROTOBUF STREAM */}
          <div className="lg:col-span-7 space-y-6">
            {/* 3. EXECUTIVE FINANCIAL FORECAST HUD */}
            <SpotlightCard className="p-6 sm:p-7 glass rounded-3xl border border-white/10 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div>
                  <span className="num text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    PREDICTED NET CAMPAIGN ROI ({targetChannel.toUpperCase()})
                  </span>
                  <div className="text-4xl sm:text-5xl font-extrabold mt-1 num flex items-baseline gap-3">
                    <span className={decisionColors.text}>
                      <CipherNumber
                        value={
                          prediction
                            ? `${prediction.net_roi_percent >= 0 ? '+' : ''}${prediction.net_roi_percent.toFixed(1)}%`
                            : '+0.0%'
                        }
                      />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-3.5 py-1.5 rounded-full border num text-xs font-bold tracking-wider ${decisionColors.bg} ${decisionColors.border} ${decisionColors.text}`}
                  >
                    {prediction?.decision_tier || 'STANDBY'}
                  </span>
                  <span className="num text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-[#00F0FF]" />
                    ONNX: <strong className="text-emerald-400">{prediction?.inference_latency_ms ?? 0.4} ms</strong> (&lt;50ms SLA)
                  </span>
                </div>
              </div>

              {/* 6-Tile Precision Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="num text-[10px] text-slate-400 uppercase">Estimated Reach</div>
                  <div className="text-xl font-extrabold text-white num mt-1">
                    {prediction ? prediction.estimated_reach.toLocaleString('en-IN') : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="num text-[10px] text-slate-400 uppercase">Predicted CTR</div>
                  <div className="text-xl font-extrabold text-[#00F0FF] num mt-1">
                    {prediction ? `${prediction.predicted_ctr_pct}%` : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="num text-[10px] text-slate-400 uppercase">Qualified Store Visits</div>
                  <div className="text-xl font-extrabold text-white num mt-1">
                    {prediction ? prediction.store_visits.toLocaleString('en-IN') : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="num text-[10px] text-slate-400 uppercase">Predicted Conversions</div>
                  <div className="text-xl font-extrabold text-[#10B981] num mt-1">
                    {prediction ? prediction.predicted_conversions.toLocaleString('en-IN') : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="num text-[10px] text-slate-400 uppercase">Expected Gross Revenue</div>
                  <div className="text-xl font-extrabold text-emerald-300 num mt-1">
                    {prediction ? formatMoney(prediction.expected_gross_revenue) : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="num text-[10px] text-slate-400 uppercase">Cost Per Click (CPC)</div>
                  <div className="text-xl font-extrabold text-amber-300 num mt-1">
                    {prediction ? formatMoney(prediction.cpc, 2) : '—'}
                  </div>
                </div>
              </div>
            </SpotlightCard>

            {/* 4. LIVE PROTOBUF ENGAGEMENT VELOCITY STREAM */}
            <SpotlightCard className="p-6 glass rounded-3xl border border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Radio className="size-4 text-[#00F0FF] animate-pulse" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeCreator?.data_source === 'youtube_api_v3' ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-400/45 num text-[9.5px] font-bold text-emerald-300">
                            <span className="size-1.5 rounded-full bg-[#10B981] animate-ping" />
                            LIVE API v3 • REAL-TIME STREAM
                          </span>
                          <span className="num text-[9.5px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-slate-200 font-semibold">
                            {activeCreator.platform.toUpperCase()}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/35 num text-[9.5px] font-bold text-cyan-300">
                            1.5s TELEMETRY BUFFER
                          </span>
                          <span className="num text-[9.5px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/15 text-slate-300 font-semibold">
                            {activeCreator?.data_source === 'csv_benchmark'
                              ? 'VERIFIED CSV BENCHMARK'
                              : activeCreator?.data_source === 'manual_audit'
                                ? 'MANUAL ONNX AUDIT'
                                : 'PROTOBUF BENCHMARK REPLAY'}
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {influencerId} — Likes/min, Shares/min &amp; Live Projected ROI %
                    </h3>
                  </div>
                </div>

                <div className="num text-[11px] text-slate-300 flex flex-col items-end gap-1">
                  <span className="text-cyan-300 font-semibold">
                    {activeCreator?.data_source === 'youtube_api_v3' && liveDeltaMeta.viewsDelta > 0
                      ? `+${liveDeltaMeta.viewsDelta.toLocaleString()} views / +${liveDeltaMeta.likesDelta.toLocaleString()} likes delta`
                      : `+${liveDeltaMeta.latestLikesPm || activeCreator?.likes_per_min || 0} likes/min · +${liveDeltaMeta.latestSharesPm || activeCreator?.shares_per_min || 0} shares/min`}
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span>
                      Sentiment:{' '}
                      <strong className="text-[#10B981]">
                        {activeCreator ? activeCreator.rolling_sentiment.toFixed(2) : '0.85'}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Bot Filtered:{' '}
                      <strong className="text-amber-300">
                        {activeCreator ? `${(activeCreator.bot_anomaly_ratio * 100).toFixed(1)}%` : '0.0%'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={velocitySeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="likesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="sharesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF2A85" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#FF2A85" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10B981" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090D16',
                        borderColor: 'rgba(0,240,255,0.35)',
                        borderRadius: 12,
                        fontSize: 11,
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="likes_per_min"
                      name="Likes / min"
                      stroke="#00F0FF"
                      fill="url(#likesGrad)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="shares_per_min"
                      name="Shares / min"
                      stroke="#FF2A85"
                      fill="url(#sharesGrad)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="live_roi_pct"
                      name="Live Projected ROI %"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Verified Live YouTube Video & Real Viewer Comments Card */}
              {activeCreator?.data_source === 'youtube_api_v3' && activeCreator.video_title && (
                <div className="p-3 rounded-2xl bg-[#FF2A85]/[0.06] border border-[#FF2A85]/30 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate max-w-md" title={activeCreator.video_title}>
                      YT Video: {activeCreator.video_title}
                    </span>
                    <span className="num text-[10.5px] text-rose-200 font-semibold">
                      {Number(activeCreator.real_views || 0).toLocaleString()} views ·{' '}
                      {Number(activeCreator.real_likes || 0).toLocaleString()} likes ·{' '}
                      {Number(activeCreator.real_comments || 0).toLocaleString()} comments
                    </span>
                  </div>
                  {activeCreator.recent_comments && activeCreator.recent_comments.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-white/10">
                      <span className="num text-[9.5px] uppercase tracking-wider text-slate-400">
                        Real Audience Comments (YouTube commentThreads):
                      </span>
                      {activeCreator.recent_comments.slice(0, 2).map((c, idx) => (
                        <div key={idx} className="text-[11px] text-slate-300 truncate">
                          <span className="num text-rose-300 font-semibold">{c.author}:</span> &ldquo;{c.text}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Compact Binary-Decoded Protobuf Event Ticker */}
              <div className="rounded-xl bg-[#04060c] border border-white/[0.08] p-2.5 space-y-1 max-h-28 overflow-y-auto [scrollbar-width:thin]">
                {ticker.slice(0, 6).map((ev) => (
                  <div
                    key={ev.event_id}
                    className="flex flex-col gap-0.5 num text-[10.5px] px-2 py-1 rounded hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300 truncate flex items-center gap-1.5">
                        <span className="text-cyan-400">[{ev.time_label}]</span>
                        <strong className="text-white">{ev.influencer_id}</strong> · {ev.platform}
                        {ev.data_source === 'youtube_api_v3' && (
                          <span className="px-1.5 py-0.2 rounded bg-[#FF2A85]/20 text-rose-300 text-[9px] font-bold">
                            LIVE YT API
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className={ev.is_bot_spike ? 'text-amber-400' : 'text-emerald-400'}>
                          +{ev.likes_delta} likes {ev.is_bot_spike ? '(IQR BOT FLAGGED)' : ''}
                        </span>
                        <span className="text-slate-400">+{ev.shares_delta} shares</span>
                        <span className="text-cyan-300">sent {ev.estimated_sentiment}</span>
                      </span>
                    </div>
                    {ev.data_source === 'youtube_api_v3' && (ev.video_title || ev.latest_comment) && (
                      <div className="text-[10px] text-slate-400 truncate pl-2 border-l border-[#FF2A85]/40">
                        {ev.video_title}
                        {ev.latest_comment ? ` — "${ev.latest_comment}"` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </div>
        </div>

        {/* ========================================================= */}
        {/* BOTTOM ROW: SHAP ATTRIBUTION + SAVED SHORTLIST COMPARISON */}
        {/* ========================================================= */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* 5. EXPLAINABLE AI (SHAP ATTRIBUTION) & CROSS-PLATFORM BENCHMARK */}
          <SpotlightCard className="lg:col-span-5 p-6 glass rounded-3xl border border-white/10 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-[#00F0FF]" />
                  <h3 className="text-base font-bold text-white">Explainable AI Drivers (SHAP)</h3>
                </div>
                <span className="num text-[10px] text-slate-400">PER-FORECAST PROOF</span>
              </div>

              <div className="space-y-3">
                {(prediction?.attributions || []).map((attr) => (
                  <div key={attr.driver} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{attr.driver}</span>
                      <span className="num font-bold text-white">{attr.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, attr.pct)}%`,
                          backgroundColor: attr.color,
                          boxShadow: `0 0 10px ${attr.color}70`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-Platform Benchmark Chart */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="num text-[10.5px] font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" />
                  Nykaa vs. Tira vs. Purplle Net ROI (%)
                </span>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={prediction?.cross_channel_comparison || []}
                    margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="channel" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090D16',
                        borderColor: 'rgba(0,240,255,0.35)',
                        borderRadius: 12,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="net_roi_percent" name="Net ROI (%)" radius={[6, 6, 0, 0]}>
                      {(prediction?.cross_channel_comparison || []).map((entry) => (
                        <Cell key={entry.channel} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SpotlightCard>

          {/* 6. SAVED EVALUATIONS & SHORTLIST COMPARISON TABLE */}
          <SpotlightCard className="lg:col-span-7 p-6 glass rounded-3xl border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <span className="num text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
                    SHORTLIST AUDIT LEDGER
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Saved Campaign Evaluations ({history.length})
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleExportBrief}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full glass border border-cyan-400/35 hover:border-[#00F0FF] num text-xs font-semibold text-[#00F0FF] hover:text-white transition-colors"
                >
                  <Download className="size-3.5" />
                  <span>Download Brief (JSON)</span>
                </button>
              </div>

              <div className="overflow-x-auto mt-3 max-h-[380px] [scrollbar-color:rgba(0,240,255,0.3)_transparent] [scrollbar-width:thin]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#070a13] z-10">
                    <tr className="border-b border-white/10 num text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pr-3">Creator</th>
                      <th className="py-2.5 px-2">Channel</th>
                      <th className="py-2.5 px-2 text-right">Budget</th>
                      <th className="py-2.5 px-2 text-right">Orders</th>
                      <th className="py-2.5 px-2 text-right">Revenue</th>
                      <th className="py-2.5 pl-2 text-right">Net ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] num text-xs">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Run your first forecast to populate the comparison shortlist.
                        </td>
                      </tr>
                    ) : (
                      history.map((row) => {
                        const roiColor =
                          row.net_roi_percent >= 80
                            ? 'text-[#10B981]'
                            : row.net_roi_percent >= 0
                              ? 'text-[#00F0FF]'
                              : 'text-[#FF2A85]'
                        return (
                          <tr key={row.id} className="hover:bg-white/[0.03]">
                            <td className="py-3 pr-3 font-semibold text-white whitespace-nowrap">
                              {row.influencer_id}
                              <div className="text-[10px] text-slate-400 font-normal">
                                {row.social_platform} · {row.product_category}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-slate-200 whitespace-nowrap">
                              {row.target_channel}
                            </td>
                            <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                              {formatMoney(row.campaign_budget)}
                            </td>
                            <td className="py-3 px-2 text-right text-white whitespace-nowrap">
                              {row.predicted_conversions.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-2 text-right text-emerald-300 whitespace-nowrap">
                              {formatMoney(row.expected_gross_revenue)}
                            </td>
                            <td className={`py-3 pl-2 text-right font-bold whitespace-nowrap ${roiColor}`}>
                              {row.net_roi_percent >= 0 ? '+' : ''}
                              {row.net_roi_percent.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 num text-[11px] text-slate-400">
              <span>Persisted in SQLite (`kalki_pulse.db`) · Scoped to {user?.email}</span>
              <span className="text-emerald-400">● Audit Ready</span>
            </div>
          </SpotlightCard>
        </div>
      </main>
    </div>
  )
}
