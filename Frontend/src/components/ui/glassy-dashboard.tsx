'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Database,
  Download,
  Filter,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  X,
  Youtube,
  Zap,
} from 'lucide-react'
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
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import '@fontsource-variable/manrope'
import { NykaaLogo, PurplleLogo, TiraLogo } from './PartnerLogos'
import { useAuth } from '../../context/AuthContext'

export interface GlassyDashboardProps {
  backgroundImage?: string
  backgroundCredit?: { label: string; href: string }
  workspaceName?: string
  panelFrost?: number
  initialTheme?: 'light' | 'dark'
}

type SocialPlatform = 'YouTube' | 'YouTube Shorts'
type TargetChannel = 'Nykaa' | 'Tira' | 'Purplle' | 'D2C Web'
type ProductCategory = 'Skincare' | 'Makeup' | 'Haircare' | 'Fragrance'
type Currency = 'INR' | 'USD'
type View = 'command' | 'youtube' | 'analytics' | 'shortlist'

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

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000'
const INR_PER_USD = 84.0
const studioPhoto =
  'https://cdn.21st.dev/assets/mirror/ea/ea9270b3b7246283219ac52fa77a1213e9d1efb285d76348d3620609ba6cefa7.jpg'

const CHANNELS: Array<{
  name: TargetChannel
  mult: string
  color: string
  logo?: React.ReactNode
}> = [
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
    label: 'Nykaa Skincare Shorts',
    influencer_id: '@koyal_bhattacharjee_shorts',
    social_platform: 'YouTube Shorts',
    target_channel: 'Nykaa',
    product_category: 'Skincare',
    campaign_budget: 350000,
    product_price: 1450,
  },
  {
    label: 'Tira Luxury Haul',
    influencer_id: '@super_style_yt',
    social_platform: 'YouTube',
    target_channel: 'Tira',
    product_category: 'Fragrance',
    campaign_budget: 500000,
    product_price: 2800,
  },
  {
    label: 'Purplle Everyday Makeup',
    influencer_id: '@yashita_rai_shorts',
    social_platform: 'YouTube Shorts',
    target_channel: 'Purplle',
    product_category: 'Makeup',
    campaign_budget: 180000,
    product_price: 699,
  },
  {
    label: 'Nykaa Official Serum',
    influencer_id: '@nykaa_shorts',
    social_platform: 'YouTube Shorts',
    target_channel: 'Nykaa',
    product_category: 'Skincare',
    campaign_budget: 420000,
    product_price: 1299,
  },
]

const dashboardStyles = `
.gd-app {
  --gd-ink: #25201e;
  --gd-muted: #423731;
  --gd-line: rgb(74 49 33 / 15%);
  --gd-grid: rgb(74 49 33 / 19%);
  --gd-rim: rgb(255 253 246 / 51%);
  --gd-edge-light: rgb(255 254 247 / 84%);
  --gd-edge-shade: rgb(57 40 28 / 19%);
  --gd-gloss: rgb(255 251 242 / 45%);
  --gd-frame: rgb(247 234 219 / 26%);
  --gd-rail: rgb(241 222 206 / 52%);
  --gd-card: rgb(250 242 232 / 52%);
  --gd-card-light: rgb(255 251 245 / 38%);
  --gd-raised: rgb(255 249 243 / 85%);
  --gd-inner: rgb(255 250 245 / 44%);
  --gd-surface: #f6ece2;
  --gd-track: rgb(81 49 32 / 14%);
  --gd-primary: #261e1b;
  --gd-primary-ink: #fffaf5;
  --gd-pick: #fff9f3;
  --gd-pick-ink: #241b17;
  --gd-coral: #a43c27;
  --gd-teal: #09644f;
  --gd-ochre: #996300;
  --gd-cyan: #0e7490;
  --gd-graph-ink: #40332d;
  --gd-focus: #194b48;
  --gd-dark-shadow: 35 21 14;
  inline-size: 100%;
  min-inline-size: 0;
  flex: 1 1 100%;
  position: relative;
  isolation: isolate;
  min-block-size: 100svh;
  background: #ab8e76;
  color: var(--gd-ink);
  color-scheme: light;
  font-family: "Manrope Variable", Manrope, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.gd-app[data-theme="dark"] {
  --gd-ink: #fff6e9;
  --gd-muted: #d8cbbf;
  --gd-line: rgb(243 221 198 / 16%);
  --gd-grid: rgb(243 221 198 / 16%);
  --gd-rim: rgb(255 236 212 / 26%);
  --gd-edge-light: rgb(255 242 225 / 35%);
  --gd-edge-shade: rgb(11 6 5 / 35%);
  --gd-gloss: rgb(255 237 213 / 11%);
  --gd-frame: rgb(20 18 22 / 68%);
  --gd-rail: rgb(28 24 26 / 72%);
  --gd-card: rgb(32 28 31 / 66%);
  --gd-card-light: rgb(88 78 75 / 26%);
  --gd-raised: rgb(62 54 54 / 86%);
  --gd-inner: rgb(48 41 42 / 56%);
  --gd-surface: #231e1f;
  --gd-track: rgb(245 226 212 / 15%);
  --gd-primary: #f3ddca;
  --gd-primary-ink: #231a16;
  --gd-pick: #f9eee0;
  --gd-pick-ink: #241b17;
  --gd-coral: #ff9177;
  --gd-teal: #75dac0;
  --gd-ochre: #f1be58;
  --gd-cyan: #00F0FF;
  --gd-graph-ink: #e7d9cd;
  --gd-focus: #f9bf9b;
  --gd-dark-shadow: 6 4 4;
  background: #181416;
  color-scheme: dark;
}
.gd-app *, .gd-app *::before, .gd-app *::after { box-sizing: border-box; }
.gd-app :where(button, input, select) { color: inherit; font: inherit; }
.gd-app :where(button, a, input, select):focus-visible { outline: 2px solid var(--gd-focus); outline-offset: 2px; }
.gd-app a { color: inherit; text-decoration: none; }
.gd-app button { cursor: pointer; }
.gd-app :where(h1, h2, h3, p, figure) { margin: 0; }
.gd-app h1, .gd-app h2, .gd-app h3 {
  font-family: 'Brumder', 'Barlow Condensed', 'Oswald', "Manrope Variable", sans-serif;
  letter-spacing: 0.015em;
}
.gd-app svg { flex: none; }
.gd-sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.gd-background, .gd-app::before {
  position: fixed;
  z-index: -2;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
}
.gd-background {
  object-fit: cover;
  object-position: center 60%;
  filter: sepia(.22) saturate(.78) brightness(.86);
}
.gd-app::before {
  content: "";
  z-index: -1;
  background: linear-gradient(116deg, rgb(73 48 37 / 35%), transparent 43%, rgb(162 101 63 / 24%) 76%, transparent 100%),
    linear-gradient(0deg, rgb(53 33 25 / 34%), transparent 58%);
}
.gd-app[data-theme="dark"] .gd-background { filter: sepia(.18) saturate(.7) brightness(.44); }

.gd-surround {
  inline-size: min(calc(100% - 96px), 1380px);
  margin-inline: auto;
  padding-block: 22px 12px;
}
.gd-top, .gd-dock {
  border: 1px solid var(--gd-rim);
  background: linear-gradient(165deg, var(--gd-gloss), transparent 32% 73%, var(--gd-gloss)), var(--gd-rail);
  box-shadow: inset 1px 1px 1px var(--gd-edge-light), inset -1px -1px 1px var(--gd-edge-shade),
    inset 0 -2px 5px var(--gd-gloss), 0 7px 20px rgb(var(--gd-dark-shadow) / 17%);
  backdrop-filter: blur(15px) saturate(1.35);
  -webkit-backdrop-filter: blur(15px) saturate(1.35);
}
.gd-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 390px) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-block-size: 60px;
  border-radius: 999px;
  padding: 6px 9px 6px 13px;
}
.gd-brand { display: flex; align-items: center; gap: 10px; min-inline-size: 0; padding-inline-start: 3px; }
.gd-logo {
  inline-size: 36px; block-size: 36px; display: grid; place-items: center;
  border-radius: 50%; background: var(--gd-pick); color: var(--gd-pick-ink);
  box-shadow: inset 0 0 0 1px var(--gd-gloss), 0 2px 7px rgb(var(--gd-dark-shadow) / 12%);
  font-weight: 900; font-size: 15px;
}
.gd-brand strong { display: block; font-size: 12.5px; letter-spacing: .12em; line-height: 1.1; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gd-brand small { display: block; margin-block-start: 2px; font-size: 10px; color: var(--gd-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gd-ask {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-block-size: 42px;
  max-inline-size: 100%;
  border: 1px solid var(--gd-line);
  border-radius: 999px;
  background: var(--gd-inner);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
  padding: 4px 13px 4px 9px;
  text-align: start;
}
.gd-ask:hover, .gd-icon-button:hover { background: var(--gd-raised); }
.gd-orb {
  flex: none;
  inline-size: 24px;
  block-size: 24px;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at 32% 24%, #faf7fe 5%, #72ecf1 25%, transparent 58%),
    radial-gradient(ellipse at 67% 54%, #e1b7f9, #815add 55%, #353467 79%);
  box-shadow: inset 0 0 0 .75px rgb(246 245 255 / 75%), inset 0 -2px 5px #604db4, 0 0 0 3px rgb(91 70 115 / 13%), 0 2px 8px rgb(71 46 113 / 35%);
}
.gd-prompt {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 12px; font-weight: 700;
}
.gd-ask-search { margin-inline-start: auto; width: 15px; height: 15px; color: var(--gd-muted); }
.gd-top-actions { display: flex; justify-content: flex-end; align-items: center; gap: 6px; flex-wrap: nowrap; }
.gd-pill-toggle {
  display: inline-flex; padding: 3px; border-radius: 999px;
  border: 1px solid var(--gd-line); background: var(--gd-inner);
}
.gd-pill-toggle button {
  border: 0; border-radius: 999px; padding: 5px 10px; font-size: 10.5px; font-weight: 780;
  background: transparent; color: var(--gd-muted); transition: all .2s ease;
}
.gd-pill-toggle button[aria-pressed="true"] {
  background: var(--gd-primary); color: var(--gd-primary-ink);
}
.gd-icon-button {
  position: relative; min-inline-size: 40px; min-block-size: 40px; display: inline-grid; place-items: center;
  border-radius: 999px; border: 1px solid var(--gd-line); padding: 0; background: var(--gd-inner);
}
.gd-icon-button svg { width: 16px; height: 16px; stroke-width: 1.8; }
.gd-notices { background: var(--gd-raised); }
.gd-notices i {
  position: absolute; block-size: 6px; inline-size: 6px; inset: 8px 8px auto auto; border-radius: 50%;
  background: var(--gd-coral); box-shadow: 0 0 0 2px var(--gd-surface);
}

.gd-stage-wrap { position: relative; margin-block: 11px 0; }
.gd-stage {
  color: var(--gd-ink);
  border: 1px solid var(--gd-rim);
  border-radius: 34px;
  background:
    linear-gradient(148deg, var(--gd-gloss), transparent 19% 77%, color-mix(in srgb, var(--gd-gloss) 48%, transparent)),
    var(--gd-frame);
  box-shadow: inset 1px 1px 1px var(--gd-edge-light), inset -1px -1px 1px var(--gd-edge-shade),
    inset 0 0 7px var(--gd-gloss),
    0 1px 3px rgb(var(--gd-dark-shadow) / 17%), 0 22px 72px rgb(var(--gd-dark-shadow) / 22%);
  backdrop-filter: blur(var(--gd-panel-frost, 14px)) saturate(1.24);
  -webkit-backdrop-filter: blur(var(--gd-panel-frost, 14px)) saturate(1.24);
}
.gd-stage-scroll {
  block-size: max(620px, min(880px, calc(100svh - 155px)));
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gd-line) transparent;
  border-radius: inherit;
  padding: clamp(20px, 2.2vw, 34px) clamp(24px, 3vw, 46px) 44px;
}
.gd-view-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 22px;
  margin-block-end: 18px;
}
.gd-view-head h1 {
  font-size: clamp(28px, 3.2vw, 46px);
  font-weight: 760;
  line-height: 1.03;
}
.gd-view-head p { color: var(--gd-muted); font-size: 13px; margin-block-start: 6px; }
.gd-view-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }

.gd-primary, .gd-secondary {
  display: inline-flex; justify-content: center; align-items: center; gap: 7px;
  min-block-size: 38px; padding: 7px 14px;
  font-size: 12px; font-weight: 780; line-height: 1.2; border-radius: 999px;
  border: 1px solid transparent; transition: all .2s ease;
}
.gd-primary { background: var(--gd-primary); color: var(--gd-primary-ink); }
.gd-secondary { background: var(--gd-raised); border-color: var(--gd-rim); color: var(--gd-ink); }
.gd-primary:hover { filter: brightness(1.12); }
.gd-secondary:hover { background: var(--gd-surface); }
.gd-primary:disabled, .gd-secondary:disabled { opacity: .5; cursor: not-allowed; }
.gd-primary svg, .gd-secondary svg { width: 14px; height: 14px; }

.gd-panel, .gd-metric, .gd-summary {
  min-inline-size: 0;
  border: 1px solid var(--gd-rim);
  border-radius: 20px;
  background: linear-gradient(144deg, var(--gd-card-light), transparent 66%), var(--gd-card);
  box-shadow: inset 0 1px 1px var(--gd-edge-light), inset 0 -1px 1px var(--gd-edge-shade), 0 6px 18px rgb(var(--gd-dark-shadow) / 9%);
}
.gd-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 7px; background: var(--gd-inner); }
.gd-summary .gd-metric { border-radius: 14px; }
.gd-panel { padding: 16px 18px; }
.gd-panel-head {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start;
  gap: 7px 12px; margin-block-end: 12px;
}
.gd-panel-head h2 { font-size: 17px; font-weight: 780; }
.gd-panel-head p { font-size: 11.5px; color: var(--gd-muted); margin-block-start: 2px; }

.gd-metric { display: flex; flex-direction: column; justify-content: space-between; min-block-size: 108px; padding: 12px 14px; }
.gd-metric[data-tone="teal"] {
  --gd-coral: #ffc8b8;
  --gd-teal: #b8f1dd;
  --gd-muted: #e4f5ef;
  color: #fff;
  border-color: rgb(196 248 231 / 55%);
  background: radial-gradient(ellipse at 5% -20%, #3a9381, transparent 68%), linear-gradient(145deg, #1e7461, #08443a);
  box-shadow: inset 0 1px 2px rgb(214 252 240 / 45%), 0 6px 14px rgb(19 78 64 / 17%);
}
.gd-metric-head { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 11px; font-weight: 740; color: var(--gd-muted); }
.gd-metric[data-tone="teal"] .gd-metric-head { color: #e4f5ef; }
.gd-metric-icon {
  display: grid; place-items: center; flex: none;
  inline-size: 28px; block-size: 28px; border-radius: 10px;
  background: var(--gd-inner); box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-metric-icon svg { width: 14px; height: 14px; }
.gd-metric[data-tone="teal"] .gd-metric-icon { background: rgb(235 255 247 / 16%); }
.gd-metric-value { display: block; font-size: clamp(21px, 2.2vw, 31px); line-height: 1.08; margin-block: 4px 6px; font-weight: 820; }
.gd-metric-caption { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; color: var(--gd-muted); font-size: 10.5px; font-weight: 660; }

.gd-command-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.15fr); gap: 14px; align-items: start; }
.gd-command-col { display: grid; gap: 14px; min-inline-size: 0; }
.gd-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.gd-analytics-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 14px; }

.gd-balance-number { font-size: clamp(32px, 3.6vw, 52px); font-weight: 840; line-height: 1.02; letter-spacing: -.04em; }
.gd-unit { border-radius: 999px; padding: 4px 9px; background: var(--gd-raised); border: 1px solid var(--gd-line); font-size: 10.5px; font-weight: 800; }
.gd-streams { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; border-radius: 14px; background: var(--gd-inner); padding: 10px; margin-top: 12px; }
.gd-streams div + div { border-inline-start: 1px solid var(--gd-line); padding-inline-start: 10px; }
.gd-streams span { display: block; font-size: 10px; color: var(--gd-muted); }
.gd-streams strong { display: block; font-size: 12.5px; font-weight: 820; margin-top: 3px; }

.gd-field-label { display: block; font-size: 10.5px; font-weight: 760; letter-spacing: .08em; text-transform: uppercase; color: var(--gd-muted); margin-bottom: 6px; }
.gd-input, .gd-select {
  inline-size: 100%; border: 1px solid var(--gd-line); border-radius: 12px;
  background: var(--gd-inner); padding: 9px 12px; font-size: 12.5px; color: var(--gd-ink);
}
.gd-select option { background: var(--gd-surface); color: var(--gd-ink); }
.gd-seg { display: grid; gap: 6px; padding: 4px; border-radius: 14px; background: var(--gd-inner); border: 1px solid var(--gd-line); }
.gd-seg button {
  padding: 7px 10px; border-radius: 10px; border: 0; font-size: 11.5px; font-weight: 720;
  background: transparent; color: var(--gd-muted); transition: all .2s ease;
}
.gd-seg button[aria-pressed="true"] {
  background: var(--gd-primary); color: var(--gd-primary-ink);
}

.gd-status {
  --gd-status-color: var(--gd-graph-ink);
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 780;
  background: color-mix(in srgb, var(--gd-status-color) 14%, var(--gd-inner));
  color: var(--gd-status-color); white-space: nowrap;
}
.gd-status[data-state="teal"] { --gd-status-color: var(--gd-teal); }
.gd-status[data-state="coral"] { --gd-status-color: var(--gd-coral); }
.gd-status[data-state="ochre"] { --gd-status-color: var(--gd-ochre); }
.gd-status i { inline-size: 6px; block-size: 6px; border-radius: 50%; background: currentColor; }

.gd-search, .gd-filter {
  display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--gd-line); border-radius: 10px;
  background: var(--gd-inner); min-block-size: 36px; padding: 0 9px;
}
.gd-search svg, .gd-filter svg { width: 14px; height: 14px; color: var(--gd-muted); }
.gd-search input { flex: 1; min-inline-size: 110px; border: 0; background: transparent; font-size: 11.5px; }
.gd-search input::placeholder { color: var(--gd-muted); opacity: .85; }
.gd-filter select { border: 0; background: transparent; font-size: 11.5px; }
.gd-filter select option { color: var(--gd-ink); background: var(--gd-surface); }

.gd-table-scroll { max-inline-size: 100%; overflow: auto; scrollbar-width: thin; }
.gd-table-scroll table { inline-size: 100%; border-spacing: 0; text-align: start; }
.gd-table-scroll th, .gd-table-scroll td { padding: 10px 10px; text-align: start; }
.gd-table-scroll th { background: var(--gd-inner); font-size: 10.5px; color: var(--gd-muted); font-weight: 800; }
.gd-table-scroll th:first-child { border-radius: 8px 0 0 8px; }
.gd-table-scroll th:last-child { border-radius: 0 8px 8px 0; }
.gd-table-scroll td { white-space: nowrap; font-size: 11.5px; }
.gd-table-scroll tr + tr td { border-top: 1px solid var(--gd-line); }
.gd-table-scroll tbody tr:hover { background: var(--gd-inner); cursor: pointer; }

.gd-mix-track { display: block; height: 7px; border-radius: 999px; overflow: hidden; background: var(--gd-track); }
.gd-mix-track .gd-fill { display: block; block-size: 100%; border-radius: inherit; }

.gd-dock {
  position: absolute; z-index: 20;
  display: flex; align-items: center; gap: 3px; padding: 4px; border-radius: 999px;
}
.gd-dock-side { flex-direction: column; left: -24px; top: clamp(66px, 16vh, 148px); }
.gd-dock-bottom { left: 50%; bottom: -24px; translate: -50% 0; }
.gd-dock a {
  z-index: 1; position: relative; display: flex; gap: 6px; justify-content: center; align-items: center;
  min-inline-size: 44px; min-block-size: 44px; padding: 0 14px; border-radius: 999px;
  font-size: 11.5px; font-weight: 790; white-space: nowrap;
}
.gd-dock-side a { padding: 0; }
.gd-dock a svg { width: 16px; height: 16px; stroke-width: 1.9; }
.gd-dock a[aria-current="page"] { color: var(--gd-pick-ink); }
.gd-dock a:not([aria-current="page"]):hover { background: var(--gd-inner); }
.gd-dock-indicator {
  position: absolute; inset: 0 auto auto 0; pointer-events: none; visibility: hidden;
  border-radius: 999px; background: var(--gd-pick); box-shadow: inset 0 1px 0 white, 0 2px 7px rgb(var(--gd-dark-shadow) / 16%);
}
.gd-dock-indicator[data-ready="true"] { visibility: visible; transition: transform .36s cubic-bezier(.24, .89, .26, 1), width .36s cubic-bezier(.24, .89, .26, 1), height .36s cubic-bezier(.24, .89, .26, 1); }
.gd-dock-side .gd-dock-text, .gd-dock-short { display: none; }
.gd-dock-tip {
  display: none; position: absolute; left: calc(100% + 8px); z-index: 10; pointer-events: none;
  color: var(--gd-ink); background: var(--gd-surface); padding: 6px 10px; border: 1px solid var(--gd-rim);
  border-radius: 8px; box-shadow: 0 3px 8px rgb(var(--gd-dark-shadow) / 17%); font-size: 11px;
}
.gd-dock-side a:is(:hover, :focus-visible) .gd-dock-tip { display: inline; }

.gd-footer { padding: 34px 4px 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.gd-footer > * {
  border-radius: 999px; padding: 5px 10px; color: var(--gd-ink); font-size: 10.5px; font-weight: 740;
  background: var(--gd-raised); border: 1px solid var(--gd-line); display: inline-flex; align-items: center; gap: 5px;
}

.gd-dialog {
  max-inline-size: min(calc(100% - 26px), 510px); inline-size: 100%;
  border-radius: 24px; border: 1px solid var(--gd-rim); color: var(--gd-ink); padding: 0;
  background: var(--gd-surface); box-shadow: 0 20px 80px rgb(var(--gd-dark-shadow) / 45%);
}
.gd-dialog::backdrop { background: rgb(15 12 12 / 55%); backdrop-filter: blur(6px); }
.gd-dialog-inner { padding: 20px; }
.gd-dialog-inner > header { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.gd-dialog-inner h2 { font-size: 22px; font-weight: 800; }
.gd-quick-list { display: grid; gap: 6px; }
.gd-quick-list button {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px;
  text-align: start; border: 1px solid var(--gd-line); border-radius: 12px; background: var(--gd-inner);
}
.gd-quick-list button:hover { background: var(--gd-raised); }
.gd-quick-list strong { display: block; font-size: 12.5px; }
.gd-quick-list small { display: block; color: var(--gd-muted); font-size: 11px; margin-top: 2px; }

@media (max-width: 1060px) {
  .gd-surround { inline-size: calc(100% - 64px); }
  .gd-command-grid, .gd-analytics-grid { grid-template-columns: minmax(0, 1fr); }
  .gd-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .gd-surround { padding-top: 12px; padding-bottom: calc(78px + env(safe-area-inset-bottom)); inline-size: calc(100% - 20px); }
  .gd-top { grid-template-columns: minmax(0, 1fr) auto; padding: 8px 10px; border-radius: 22px; }
  .gd-ask { grid-area: 2 / 1 / 3 / -1; }
  .gd-stage { border-radius: 22px; }
  .gd-stage-scroll { block-size: auto; padding: 16px 14px 20px; overflow: visible; }
  .gd-dock-side { display: none; }
  .gd-dock-bottom { position: fixed; inset: auto 10px calc(8px + env(safe-area-inset-bottom)); translate: none; justify-content: space-between; }
  .gd-dock-bottom a { flex: 1; flex-direction: column; gap: 2px; padding: 4px; min-block-size: 46px; font-size: 9.5px; }
  .gd-dock-bottom .gd-dock-text { display: none; }
  .gd-dock-bottom .gd-dock-short { display: inline; }
  .gd-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .gd-app *, .gd-app *::before, .gd-app *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`

const views: Array<{
  id: View
  label: string
  short: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  prompt: string
}> = [
  {
    id: 'command',
    label: 'Command Center',
    short: 'Command',
    icon: LayoutDashboard,
    description: 'Configure creator campaigns, run AI ROI forecasts, and inspect live financial yield.',
    prompt: 'Forecast campaign ROI for a creator...',
  },
  {
    id: 'youtube',
    label: 'Live YouTube',
    short: 'YouTube',
    icon: Youtube,
    description: 'Track any public YouTube @handle or Video/Shorts URL with real-time velocity telemetry.',
    prompt: 'Sync live @handle or Shorts metrics...',
  },
  {
    id: 'analytics',
    label: 'ROI Analytics',
    short: 'Analytics',
    icon: BarChart3,
    description: 'Compare Nykaa, Tira, Purplle & D2C returns with explainable attribution drivers.',
    prompt: 'Compare cross-channel ROI & drivers...',
  },
  {
    id: 'shortlist',
    label: 'Saved Shortlist',
    short: 'Shortlist',
    icon: BriefcaseBusiness,
    description: 'Compare saved creator forecasts, filter by channel, and export campaign reports.',
    prompt: 'Review saved campaign shortlist...',
  },
]

const routeOrder: View[] = views.map((v) => v.id)

function routeFromHash(): View {
  if (typeof location === 'undefined') return 'command'
  const id = location.hash.slice(1)
  return routeOrder.find((v) => v === id) ?? 'command'
}

function saveCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function useNavigationReducedMotion(motion: boolean) {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced || !motion
}

gsap.registerPlugin(useGSAP)

function Dock({
  active,
  side = false,
  select,
}: {
  active: View
  side?: boolean
  select: (view: View) => void
}) {
  const nav = useRef<HTMLElement>(null)
  const marker = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = nav.current
    const indicator = marker.current
    if (!container || !indicator) return
    const adjust = () => {
      const current = container.querySelector<HTMLElement>('[aria-current="page"]')
      if (!current) return
      indicator.style.width = `${current.offsetWidth}px`
      indicator.style.height = `${current.offsetHeight}px`
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`
      indicator.dataset.ready = 'true'
    }
    const observer = new ResizeObserver(adjust)
    observer.observe(container)
    container.querySelectorAll('a').forEach((link) => observer.observe(link))
    adjust()
    return () => observer.disconnect()
  }, [active])

  const onSelect = (event: MouseEvent<HTMLAnchorElement>, id: View) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    select(id)
  }

  return (
    <nav
      ref={nav}
      className={side ? 'gd-dock gd-dock-side' : 'gd-dock gd-dock-bottom'}
      aria-label={side ? 'Workspace shortcuts' : 'Workspace views'}
    >
      <span ref={marker} className="gd-dock-indicator" aria-hidden="true" />
      {views.map(({ id, label, short, icon: Icon }) => (
        <a
          href={`#${id}`}
          key={id}
          aria-label={label}
          aria-current={active === id ? 'page' : undefined}
          onClick={(event) => onSelect(event, id)}
        >
          <Icon aria-hidden="true" />
          <span className="gd-dock-text" aria-hidden="true">
            {label}
          </span>
          <span className="gd-dock-short" aria-hidden="true">
            {short}
          </span>
          {side && (
            <span className="gd-dock-tip" aria-hidden="true">
              {label}
            </span>
          )}
        </a>
      ))}
    </nav>
  )
}

function Dialog({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const label = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    dialog?.querySelector('input')?.focus()
  }, [])
  return (
    <dialog
      className="gd-dialog"
      ref={ref}
      aria-labelledby={label}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <section className="gd-dialog-inner">
        <header>
          <h2 id={label}>{title}</h2>
          <button
            type="button"
            className="gd-icon-button"
            aria-label="Close dialog"
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  )
}

type Modal = 'search' | 'notifications' | { row: SavedHistoryRow } | null

export function GlassyDashboard({
  backgroundImage = studioPhoto,
  backgroundCredit =
    backgroundImage === studioPhoto
      ? { label: 'KALKI Pulse Workspace', href: '#command' }
      : undefined,
  workspaceName = 'KALKI PULSE',
  panelFrost = 14,
  initialTheme = 'dark',
}: GlassyDashboardProps = {}) {
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()

  // Workspace view & theme state
  const [view, setView] = useState<View>(routeFromHash)
  const [active, setActive] = useState<View>(view)
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  useEffect(() => setTheme(initialTheme), [initialTheme])
  const [modal, setModal] = useState<Modal>(null)
  const [readNotices, setReadNotices] = useState(false)

  // Campaign state (canonical INR)
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
  const [liveDeltaMeta, setLiveDeltaMeta] = useState({
    viewsDelta: 0,
    likesDelta: 0,
    latestLikesPm: 0,
    latestSharesPm: 0,
  })
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [history, setHistory] = useState<SavedHistoryRow[]>([])
  const [predicting, setPredicting] = useState<boolean>(false)
  const [bursting, setBursting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filters for search/shortlist/activity
  const [quickQuery, setQuickQuery] = useState('')
  const [tickerQuery, setTickerQuery] = useState('')
  const [tickerFilter, setTickerFilter] = useState<'all' | 'yt' | 'bot'>('all')
  const [shortlistQuery, setShortlistQuery] = useState('')
  const [shortlistChannel, setShortlistChannel] = useState<string>('All channels')

  const tickCountRef = useRef<number>(0)
  const root = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const reduced = useNavigationReducedMotion(true)
  useGSAP({ scope: root })

  const formatMoney = useCallback(
    (inrVal: number, decimals = 0) => {
      if (currency === 'USD') {
        const usdVal = inrVal / INR_PER_USD
        return (
          '$' +
          usdVal.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        )
      }
      return (
        '₹' +
        inrVal.toLocaleString('en-IN', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      )
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
      // silent resilience
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
          setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Prediction Engine.')
        }
      } finally {
        if (!isSilent) setPredicting(false)
      }
    },
    [
      token,
      authHeaders,
      influencerId,
      socialPlatform,
      targetChannel,
      productCategory,
      campaignBudgetInr,
      productPriceInr,
      fetchHistory,
    ]
  )

  const fetchStreamTelemetry = useCallback(
    async (targetId: string) => {
      if (!token || !targetId) return
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/stream/telemetry/${encodeURIComponent(targetId)}`,
          { headers: authHeaders }
        )
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
        if (data.recent_events) setTicker(data.recent_events)
        if (data.youtube_live_active !== undefined) {
          setYoutubeLiveActive(Boolean(data.youtube_live_active))
        }
        tickCountRef.current += 1
        if (tickCountRef.current % 3 === 0) {
          runPrediction({ silent: true, save_to_history: false })
        }
      } catch {
        // silent poll resilience
      }
    },
    [token, authHeaders, runPrediction]
  )

  useEffect(() => {
    if (!token) return
    fetchLiveFeed()
    fetchHistory()
    runPrediction()
  }, [token])

  useEffect(() => {
    if (!token) return
    let intervalId: number | null = null
    let feedCounter = 0

    const tick = () => {
      if (document.hidden) return
      fetchStreamTelemetry(influencerId)
      feedCounter += 1
      if (feedCounter % 3 === 0) fetchLiveFeed()
    }

    tick()
    intervalId = window.setInterval(tick, 1500)
    const handleVisibility = () => {
      if (!document.hidden) tick()
    }
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
        await fetchStreamTelemetry(influencerId)
        await runPrediction()
      }
    } catch {
      setErrorMsg('Failed to trigger engagement simulation.')
    } finally {
      setBursting(false)
    }
  }

  const trackYoutubeTarget = async (rawTarget: string) => {
    const cleaned = rawTarget.trim()
    if (!token || !cleaned || ytTracking) return
    setYtTracking(true)
    setErrorMsg(null)
    setYtBannerMsg(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/youtube/track`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ video_url_or_id: cleaned }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.detail || `YouTube tracking error (${res.status})`)
      }
      const trackedNiche = body.niche as ProductCategory
      const validCat: ProductCategory =
        trackedNiche === 'Skincare' ||
        trackedNiche === 'Makeup' ||
        trackedNiche === 'Haircare' ||
        trackedNiche === 'Fragrance'
          ? trackedNiche
          : productCategory

      const trackedPlat: SocialPlatform =
        body.platform === 'YouTube Shorts' || body.platform_key === 'youtube_shorts'
          ? 'YouTube Shorts'
          : 'YouTube'

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
          `Synced ${body.channel_title} (${Number(
            body.subscriber_count
          ).toLocaleString()} subscribers · Latest ${trackedPlat}: "${body.video_title}")`
        )
      } else {
        setYtChannelSummary(null)
        setYtBannerMsg(
          `Synced ${trackedPlat}: "${body.video_title}" (${body.channel_title}) · ${Number(
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

  const handleTrackYoutubeVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    await trackYoutubeTarget(ytInput)
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

  const changeView = useCallback((next: View) => {
    setActive(next)
    setView(next)
  }, [])

  function selectView(next: View) {
    if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`)
    changeView(next)
  }

  useEffect(() => {
    const restore = () => changeView(routeFromHash())
    addEventListener('popstate', restore)
    addEventListener('hashchange', restore)
    return () => {
      removeEventListener('popstate', restore)
      removeEventListener('hashchange', restore)
    }
  }, [changeView])

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 })
  }, [view])

  useGSAP(
    () => {
      const layer = content.current
      if (!layer || reduced) return
      gsap.fromTo(
        layer,
        { opacity: 0.45, y: 8 },
        { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,transform' }
      )
    },
    { scope: content, dependencies: [view, reduced], revertOnUpdate: true }
  )

  const activeCreator = useMemo(
    () => creators.find((c) => c.influencer_id === influencerId) || creators[0] || null,
    [creators, influencerId]
  )

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

  const filteredTicker = useMemo(() => {
    const q = tickerQuery.trim().toLowerCase()
    return ticker.filter((ev) => {
      if (tickerFilter === 'yt' && ev.data_source !== 'youtube_api_v3') return false
      if (tickerFilter === 'bot' && !ev.is_bot_spike) return false
      if (!q) return true
      return [ev.influencer_id, ev.platform, ev.video_title || '', ev.latest_comment || '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [ticker, tickerQuery, tickerFilter])

  const filteredHistory = useMemo(() => {
    const q = shortlistQuery.trim().toLowerCase()
    return history.filter((row) => {
      if (shortlistChannel !== 'All channels' && row.target_channel !== shortlistChannel) {
        return false
      }
      if (!q) return true
      return [row.influencer_id, row.social_platform, row.product_category, row.target_channel]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [history, shortlistQuery, shortlistChannel])

  const botAlertEvents = useMemo(
    () => ticker.filter((t) => t.is_bot_spike).slice(0, 5),
    [ticker]
  )

  const exportShortlistCsv = () => {
    saveCsv(`kalki-pulse-shortlist-${currency.toLowerCase()}.csv`, [
      ['ID', 'Creator', 'Platform', 'Channel', 'Category', 'Budget (INR)', 'Orders', 'Revenue (INR)', 'Net ROI %', 'Decision Tier'],
      ...filteredHistory.map((row) => [
        row.id,
        row.influencer_id,
        row.social_platform,
        row.target_channel,
        row.product_category,
        row.campaign_budget,
        row.predicted_conversions,
        row.expected_gross_revenue,
        row.net_roi_percent,
        row.decision_tier,
      ]),
    ])
  }

  const exportJsonBrief = () => {
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

  const current = views.find((item) => item.id === view)!
  const close = () => setModal(null)
  const roiTierState =
    !prediction || prediction.net_roi_percent >= 80
      ? 'teal'
      : prediction.net_roi_percent >= 0
        ? 'ochre'
        : 'coral'

  const chartGridColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(64,51,45,0.14)'
  const chartTickColor = theme === 'dark' ? '#d8cbbf' : '#423731'

  return (
    <div
      className="gd-app"
      data-theme={theme}
      ref={root}
      style={{ '--gd-panel-frost': Math.max(0, Math.min(36, panelFrost)) + 'px' } as CSSProperties}
    >
      <style>{dashboardStyles}</style>
      <img
        className="gd-background"
        src={backgroundImage}
        alt=""
        aria-hidden="true"
      />

      <div className="gd-surround">
        {/* ========================================================= */}
        {/* TOP SPATIAL NAVIGATION BAR                                */}
        {/* ========================================================= */}
        <header className="gd-top">
          <div className="gd-brand">
            <button
              type="button"
              onClick={() => navigate('/')}
              title="Back to Home"
              className="gd-logo"
              aria-label="KALKI Pulse Home"
            >
              K
            </button>
            <div style={{ minWidth: 0 }}>
              <strong>{user?.brand_name || workspaceName}</strong>
              <small>
                {youtubeLiveActive ? '● YouTube Live API Ready' : 'ROI Workspace'} ·{' '}
                {storeMode === 'redis_live' ? 'Redis Stream' : 'Live Buffer'}
              </small>
            </div>
          </div>

          <button
            type="button"
            className="gd-ask"
            aria-label="Quick search views and scenarios"
            onClick={() => setModal('search')}
          >
            <span className="gd-orb" aria-hidden="true" />
            <span className="gd-prompt">{current.prompt}</span>
            <Search aria-hidden="true" className="gd-ask-search" />
          </button>

          <div className="gd-top-actions">
            <div className="gd-pill-toggle" role="group" aria-label="Currency">
              {(['INR', 'USD'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  aria-pressed={currency === curr}
                  onClick={() => setCurrency(curr)}
                >
                  {curr === 'INR' ? '₹' : '$'}
                </button>
              ))}
            </div>

            <button
              type="button"
              title="Data Cleaning Lab"
              className="gd-icon-button"
              aria-label="Open Data Cleaning Lab"
              onClick={() => navigate('/data-pipeline')}
            >
              <Database aria-hidden="true" />
            </button>

            <button
              title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              type="button"
              className="gd-icon-button"
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>

            <button
              type="button"
              className="gd-icon-button gd-notices"
              aria-label="Alerts & Notifications"
              onClick={() => {
                setReadNotices(true)
                setModal('notifications')
              }}
            >
              <Bell aria-hidden="true" />
              {!readNotices && botAlertEvents.length > 0 && <i aria-hidden="true" />}
            </button>

            <button
              type="button"
              title="Sign Out"
              className="gd-icon-button"
              aria-label="Sign Out"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* MAIN GLASS WORKSPACE STAGE + FLOATING DOCK                */}
        {/* ========================================================= */}
        <div className="gd-stage-wrap">
          <Dock active={active} side select={selectView} />

          <main className="gd-stage">
            <div className="gd-stage-scroll" ref={scrollArea}>
              <header className="gd-view-head">
                <div>
                  <h1>{current.label}</h1>
                  <p>{current.description}</p>
                </div>

                <div className="gd-view-actions">
                  {prediction && (
                    <span className="gd-status" data-state={roiTierState}>
                      <i aria-hidden="true" />
                      {prediction.decision_tier} · {prediction.inference_latency_ms}ms
                    </span>
                  )}

                  {view === 'shortlist' && (
                    <button type="button" className="gd-primary" onClick={exportShortlistCsv}>
                      <ArrowDownToLine aria-hidden="true" />
                      Export CSV
                    </button>
                  )}

                  {view === 'analytics' && (
                    <button type="button" className="gd-primary" onClick={exportJsonBrief}>
                      <Download aria-hidden="true" />
                      Export Brief (JSON)
                    </button>
                  )}
                </div>
              </header>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-2xl flex items-center gap-2.5 text-xs"
                  style={{
                    background: 'color-mix(in srgb, var(--gd-coral) 16%, var(--gd-inner))',
                    border: '1px solid color-mix(in srgb, var(--gd-coral) 45%, transparent)',
                  }}
                >
                  <AlertTriangle className="size-4 shrink-0" style={{ color: 'var(--gd-coral)' }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="gd-content" ref={content} key={view} data-view={view}>
                {/* ─── VIEW 1: COMMAND CENTER ─── */}
                {view === 'command' && (
                  <div className="space-y-4">
                    {/* 1-Click Scenario Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-75 mr-1">
                        Quick Scenarios:
                      </span>
                      {PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyPreset(p)}
                          className="gd-secondary"
                          style={{ minBlockSize: 32, padding: '4px 12px', fontSize: 11.5 }}
                        >
                          <Sparkles className="size-3.5" style={{ color: 'var(--gd-teal)' }} />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="gd-command-grid">
                      {/* LEFT COLUMN: ROI RESULT + 4 METRICS + LIVE STREAM PREVIEW */}
                      <div className="gd-command-col">
                        <section className="gd-panel">
                          <header className="gd-panel-head">
                            <div>
                              <h2>Predicted Net ROI ({targetChannel})</h2>
                              <p>
                                {influencerId} · {socialPlatform} · {productCategory}
                              </p>
                            </div>
                            <span className="gd-unit">{currency}</span>
                          </header>

                          <div
                            className="gd-balance-number"
                            style={{
                              color:
                                !prediction || prediction.net_roi_percent >= 80
                                  ? 'var(--gd-teal)'
                                  : prediction.net_roi_percent >= 0
                                    ? 'var(--gd-ochre)'
                                    : 'var(--gd-coral)',
                            }}
                          >
                            {prediction
                              ? `${prediction.net_roi_percent >= 0 ? '+' : ''}${prediction.net_roi_percent.toFixed(1)}%`
                              : '+0.0%'}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-4">
                            <button
                              type="button"
                              className="gd-primary"
                              disabled={predicting}
                              onClick={() => runPrediction()}
                            >
                              <Zap aria-hidden="true" />
                              {predicting ? 'Forecasting...' : 'Forecast Campaign ROI'}
                            </button>
                            <button
                              type="button"
                              className="gd-secondary"
                              onClick={() => selectView('analytics')}
                            >
                              Deep Breakdown <ArrowRight aria-hidden="true" />
                            </button>
                          </div>

                          <div className="gd-streams">
                            <div>
                              <span>Gross Revenue</span>
                              <strong>
                                {prediction ? formatMoney(prediction.expected_gross_revenue) : '—'}
                              </strong>
                            </div>
                            <div>
                              <span>Budget</span>
                              <strong>{formatMoney(campaignBudgetInr)}</strong>
                            </div>
                            <div>
                              <span>Est. CPC</span>
                              <strong>{prediction ? formatMoney(prediction.cpc, 2) : '—'}</strong>
                            </div>
                          </div>
                        </section>

                        <div className="gd-summary">
                          <article className="gd-metric" data-tone="teal">
                            <div className="gd-metric-head">
                              <span>Predicted Orders</span>
                              <span className="gd-metric-icon">
                                <TrendingUp />
                              </span>
                            </div>
                            <strong className="gd-metric-value">
                              {prediction
                                ? prediction.predicted_conversions.toLocaleString('en-IN')
                                : '—'}
                            </strong>
                            <div className="gd-metric-caption">Verified conversion forecast</div>
                          </article>

                          <article className="gd-metric">
                            <div className="gd-metric-head">
                              <span>Store Visits</span>
                              <span className="gd-metric-icon">
                                <Users />
                              </span>
                            </div>
                            <strong className="gd-metric-value">
                              {prediction ? prediction.store_visits.toLocaleString('en-IN') : '—'}
                            </strong>
                            <div className="gd-metric-caption">Qualified high-intent clicks</div>
                          </article>

                          <article className="gd-metric">
                            <div className="gd-metric-head">
                              <span>Estimated Reach</span>
                              <span className="gd-metric-icon">
                                <Activity />
                              </span>
                            </div>
                            <strong className="gd-metric-value">
                              {prediction ? prediction.estimated_reach.toLocaleString('en-IN') : '—'}
                            </strong>
                            <div className="gd-metric-caption">Filtered organic audience</div>
                          </article>

                          <article className="gd-metric">
                            <div className="gd-metric-head">
                              <span>Predicted CTR</span>
                              <span className="gd-metric-icon">
                                <Cpu />
                              </span>
                            </div>
                            <strong className="gd-metric-value">
                              {prediction ? `${prediction.predicted_ctr_pct}%` : '—'}
                            </strong>
                            <div className="gd-metric-caption">
                              Latency {prediction?.inference_latency_ms ?? 0.4} ms
                            </div>
                          </article>
                        </div>

                        {/* Live Engagement Spark Chart */}
                        <section className="gd-panel">
                          <header className="gd-panel-head">
                            <div>
                              <h2>Live Velocity Pulse</h2>
                              <p>
                                {influencerId} ·{' '}
                                {activeCreator ? `${activeCreator.likes_per_min} likes/min` : 'Active'}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="gd-secondary"
                              style={{ minBlockSize: 30, padding: '4px 10px', fontSize: 11 }}
                              onClick={() => selectView('youtube')}
                            >
                              Full Stream <ArrowUpRight aria-hidden="true" />
                            </button>
                          </header>
                          <div style={{ width: '100%', height: 170 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={velocitySeries}
                                margin={{ top: 4, right: 6, left: -12, bottom: 0 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                                <XAxis dataKey="time" stroke={chartTickColor} tick={{ fontSize: 10 }} />
                                <YAxis stroke={chartTickColor} tick={{ fontSize: 10 }} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: theme === 'dark' ? '#1c181a' : '#fffaf5',
                                    borderColor: 'var(--gd-rim)',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    color: 'var(--gd-ink)',
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="likes_per_min"
                                  name="Likes / min"
                                  stroke={theme === 'dark' ? '#75dac0' : '#09644f'}
                                  fill={theme === 'dark' ? 'rgba(117,218,192,0.22)' : 'rgba(9,100,79,0.18)'}
                                  strokeWidth={2}
                                  isAnimationActive={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="shares_per_min"
                                  name="Shares / min"
                                  stroke={theme === 'dark' ? '#ff9177' : '#a43c27'}
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </section>
                      </div>

                      {/* RIGHT COLUMN: USER-FRIENDLY CAMPAIGN CONFIGURATOR */}
                      <section className="gd-panel space-y-4">
                        <header className="gd-panel-head">
                          <div>
                            <h2>Campaign Configurator</h2>
                            <p>Pick a creator, target marketplace, budget &amp; product price</p>
                          </div>
                          <button
                            type="button"
                            className="gd-secondary"
                            style={{ minBlockSize: 30, padding: '4px 10px', fontSize: 11 }}
                            onClick={() => setCustomHandleMode((m) => !m)}
                          >
                            {customHandleMode ? 'Use Live Feed' : '+ Custom Handle'}
                          </button>
                        </header>

                        <div>
                          <label className="gd-field-label">Creator Profile</label>
                          {customHandleMode ? (
                            <input
                              type="text"
                              value={influencerId}
                              onChange={(e) => setInfluencerId(e.target.value)}
                              placeholder="@creator_handle"
                              className="gd-input"
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
                              className="gd-select"
                            >
                              {creators.map((c) => (
                                <option key={c.influencer_id} value={c.influencer_id}>
                                  {c.data_source === 'youtube_api_v3' ? '[LIVE YT] ' : ''}
                                  {c.influencer_id} · {c.niche} ({(c.followers / 1000).toFixed(0)}K) · Sent{' '}
                                  {c.rolling_sentiment}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div>
                          <span className="gd-field-label">Social Format</span>
                          <div className="gd-seg grid-cols-2">
                            {(['YouTube', 'YouTube Shorts'] as const).map((plat) => (
                              <button
                                key={plat}
                                type="button"
                                aria-pressed={socialPlatform === plat}
                                onClick={() => setSocialPlatform(plat)}
                              >
                                {plat}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="gd-field-label">Target Storefront</span>
                          <div className="grid grid-cols-2 gap-2">
                            {CHANNELS.map((ch) => {
                              const selected = targetChannel === ch.name
                              return (
                                <button
                                  key={ch.name}
                                  type="button"
                                  onClick={() => setTargetChannel(ch.name)}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl transition-all"
                                  style={{
                                    background: selected ? 'var(--gd-raised)' : 'var(--gd-inner)',
                                    border: `1px solid ${selected ? ch.color : 'var(--gd-line)'}`,
                                  }}
                                >
                                  <span className="flex items-center">
                                    {ch.logo || <strong className="text-xs">{ch.name}</strong>}
                                  </span>
                                  <span
                                    className="text-[11px] font-bold"
                                    style={{ color: 'var(--gd-teal)' }}
                                  >
                                    {ch.mult}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <span className="gd-field-label">Product Category</span>
                          <div className="gd-seg grid-cols-4">
                            {(['Skincare', 'Makeup', 'Haircare', 'Fragrance'] as const).map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                aria-pressed={productCategory === cat}
                                onClick={() => setProductCategory(cat)}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div
                            className="p-3 rounded-xl space-y-2"
                            style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">Budget ({currency})</span>
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
                                  setCampaignBudgetInr(
                                    currency === 'USD' ? Math.round(val * INR_PER_USD) : val
                                  )
                                }}
                                className="w-24 rounded-lg px-2 py-1 text-right text-xs font-bold"
                                style={{ background: 'var(--gd-raised)', border: '1px solid var(--gd-line)' }}
                              />
                            </div>
                            <input
                              type="range"
                              min={50000}
                              max={1500000}
                              step={10000}
                              value={Math.min(1500000, campaignBudgetInr)}
                              onChange={(e) => setCampaignBudgetInr(Number(e.target.value))}
                              className="w-full cursor-pointer accent-[#09644f]"
                            />
                          </div>

                          <div
                            className="p-3 rounded-xl space-y-2"
                            style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">Product Price ({currency})</span>
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
                                  setProductPriceInr(
                                    currency === 'USD' ? Math.round(val * INR_PER_USD) : val
                                  )
                                }}
                                className="w-24 rounded-lg px-2 py-1 text-right text-xs font-bold"
                                style={{ background: 'var(--gd-raised)', border: '1px solid var(--gd-line)' }}
                              />
                            </div>
                            <input
                              type="range"
                              min={250}
                              max={12000}
                              step={50}
                              value={Math.min(12000, productPriceInr)}
                              onChange={(e) => setProductPriceInr(Number(e.target.value))}
                              className="w-full cursor-pointer accent-[#09644f]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={bursting}
                            onClick={() => handleTriggerBurst('viral')}
                            className="gd-secondary"
                          >
                            <Zap aria-hidden="true" style={{ color: 'var(--gd-teal)' }} />
                            Simulate Viral Spike
                          </button>
                          <button
                            type="button"
                            disabled={bursting}
                            onClick={() => handleTriggerBurst('bot_spike')}
                            className="gd-secondary"
                          >
                            <ShieldAlert aria-hidden="true" style={{ color: 'var(--gd-coral)' }} />
                            Test Bot Filter
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                )}

                {/* ─── VIEW 2: LIVE YOUTUBE & REAL-TIME STREAM ─── */}
                {view === 'youtube' && (
                  <div className="space-y-4">
                    {/* Live YouTube @handle / URL Lookup */}
                    <section className="gd-panel space-y-3">
                      <header className="gd-panel-head">
                        <div>
                          <h2>Track Live YouTube @handle or Video / Shorts URL</h2>
                          <p>
                            Pull public channel stats, latest uploads, and real audience sentiment comments
                          </p>
                        </div>
                        <span className="gd-status" data-state="teal">
                          <i aria-hidden="true" />
                          @handle: 4 units · URL: 2 units
                        </span>
                      </header>

                      {/* 1-Click Quick Channel Sync Pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider opacity-75 mr-1">
                          1-Click Live Sync:
                        </span>
                        {['@Nykaa', '@SuperPrincessjo', '@Mrwhosetheboss', '@Purplle'].map((handle) => (
                          <button
                            key={handle}
                            type="button"
                            disabled={ytTracking}
                            onClick={() => {
                              setYtInput(handle)
                              trackYoutubeTarget(handle)
                            }}
                            className="gd-secondary"
                            style={{ minBlockSize: 30, padding: '4px 11px', fontSize: 11.5 }}
                          >
                            <Youtube aria-hidden="true" style={{ color: 'var(--gd-coral)' }} />
                            <span>{handle}</span>
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleTrackYoutubeVideo} className="flex flex-wrap gap-2.5">
                        <input
                          type="text"
                          value={ytInput}
                          onChange={(e) => setYtInput(e.target.value)}
                          placeholder="Enter @handle (e.g. @Nykaa, @SuperPrincessjo) or YouTube / Shorts URL"
                          className="gd-input flex-1 min-w-[240px]"
                        />
                        <button
                          type="submit"
                          disabled={ytTracking || !ytInput.trim()}
                          className="gd-primary"
                        >
                          <Youtube aria-hidden="true" />
                          {ytTracking ? 'Fetching...' : 'Pull Live Channel / Video'}
                        </button>
                      </form>

                      {ytBannerMsg && (
                        <div
                          className="mt-2 p-3 rounded-xl text-xs space-y-2"
                          style={{
                            background: 'color-mix(in srgb, var(--gd-teal) 12%, var(--gd-inner))',
                            border: '1px solid color-mix(in srgb, var(--gd-teal) 35%, transparent)',
                          }}
                        >
                          <div className="font-semibold">{ytBannerMsg}</div>
                          {ytChannelSummary && ytChannelSummary.latest_videos.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1.5">
                              {ytChannelSummary.latest_videos.map((v) => (
                                <button
                                  key={v.video_id}
                                  type="button"
                                  onClick={() =>
                                    trackYoutubeTarget(`https://www.youtube.com/watch?v=${v.video_id}`)
                                  }
                                  className="gd-secondary"
                                  style={{ minBlockSize: 30, padding: '4px 10px', fontSize: 11 }}
                                >
                                  [{v.platform === 'YouTube Shorts' ? 'Shorts' : 'Video'}]{' '}
                                  {v.video_title.slice(0, 34)} · {v.views.toLocaleString()} views
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    {/* Real-Time Oscilloscope + Audience Comments */}
                    <div className="gd-analytics-grid">
                      <section className="gd-panel">
                        <header className="gd-panel-head">
                          <div>
                            <h2>{influencerId} — Real-Time Engagement Velocity</h2>
                            <p>
                              {activeCreator?.data_source === 'youtube_api_v3' &&
                              liveDeltaMeta.viewsDelta > 0
                                ? `+${liveDeltaMeta.viewsDelta.toLocaleString()} views · +${liveDeltaMeta.likesDelta.toLocaleString()} likes delta`
                                : `+${liveDeltaMeta.latestLikesPm || activeCreator?.likes_per_min || 0} likes/min · +${liveDeltaMeta.latestSharesPm || activeCreator?.shares_per_min || 0} shares/min`}
                            </p>
                          </div>
                          <span
                            className="gd-status"
                            data-state={
                              activeCreator?.data_source === 'youtube_api_v3' ? 'teal' : 'ochre'
                            }
                          >
                            <i aria-hidden="true" />
                            {activeCreator?.data_source === 'youtube_api_v3'
                              ? 'LIVE API v3'
                              : '1.5s BUFFER'}
                          </span>
                        </header>

                        <div style={{ width: '100%', height: 225 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={velocitySeries}
                              margin={{ top: 6, right: 8, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                              <XAxis dataKey="time" stroke={chartTickColor} tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="left" stroke={chartTickColor} tick={{ fontSize: 10 }} />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke={theme === 'dark' ? '#75dac0' : '#09644f'}
                                tick={{ fontSize: 10 }}
                                unit="%"
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: theme === 'dark' ? '#1c181a' : '#fffaf5',
                                  borderColor: 'var(--gd-rim)',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  color: 'var(--gd-ink)',
                                }}
                              />
                              <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="likes_per_min"
                                name="Likes / min"
                                stroke={theme === 'dark' ? '#00F0FF' : '#0e7490'}
                                fill={theme === 'dark' ? 'rgba(0,240,255,0.22)' : 'rgba(14,116,144,0.16)'}
                                strokeWidth={2}
                                isAnimationActive={false}
                              />
                              <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="shares_per_min"
                                name="Shares / min"
                                stroke={theme === 'dark' ? '#ff9177' : '#a43c27'}
                                fill={theme === 'dark' ? 'rgba(255,145,119,0.2)' : 'rgba(164,60,39,0.14)'}
                                strokeWidth={2}
                                isAnimationActive={false}
                              />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="live_roi_pct"
                                name="Projected ROI %"
                                stroke={theme === 'dark' ? '#75dac0' : '#09644f'}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </section>

                      <section className="gd-panel space-y-3">
                        <header className="gd-panel-head">
                          <div>
                            <h2>Creator Signal Health</h2>
                            <p>Live sentiment &amp; bot-shield audit</p>
                          </div>
                          <Radio aria-hidden="true" style={{ color: 'var(--gd-teal)' }} />
                        </header>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div
                            className="p-3 rounded-xl"
                            style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
                          >
                            <div className="text-[11px] opacity-75">Buyer Sentiment</div>
                            <div
                              className="text-2xl font-extrabold mt-1"
                              style={{ color: 'var(--gd-teal)' }}
                            >
                              {activeCreator ? activeCreator.rolling_sentiment.toFixed(2) : '0.85'}
                            </div>
                          </div>
                          <div
                            className="p-3 rounded-xl"
                            style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
                          >
                            <div className="text-[11px] opacity-75">Bot Filtered</div>
                            <div
                              className="text-2xl font-extrabold mt-1"
                              style={{ color: 'var(--gd-coral)' }}
                            >
                              {activeCreator
                                ? `${(activeCreator.bot_anomaly_ratio * 100).toFixed(1)}%`
                                : '0.0%'}
                            </div>
                          </div>
                        </div>

                        {activeCreator?.recent_comments && activeCreator.recent_comments.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                              Recent Viewer Comments
                            </div>
                            {activeCreator.recent_comments.slice(0, 3).map((c, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl text-xs"
                                style={{
                                  background: 'var(--gd-inner)',
                                  border: '1px solid var(--gd-line)',
                                }}
                              >
                                <strong style={{ color: 'var(--gd-teal)' }}>{c.author}: </strong>
                                <span className="opacity-90">&ldquo;{c.text}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs opacity-75 pt-2">
                            Click any 1-click @handle above or enter a YouTube / Shorts URL to stream live viewer comments.
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button
                            type="button"
                            disabled={bursting}
                            onClick={() => handleTriggerBurst('viral')}
                            className="gd-secondary"
                            style={{ minBlockSize: 34, fontSize: 11 }}
                          >
                            <Zap aria-hidden="true" style={{ color: 'var(--gd-teal)' }} />
                            Viral Spike
                          </button>
                          <button
                            type="button"
                            disabled={bursting}
                            onClick={() => handleTriggerBurst('bot_spike')}
                            className="gd-secondary"
                            style={{ minBlockSize: 34, fontSize: 11 }}
                          >
                            <ShieldAlert aria-hidden="true" style={{ color: 'var(--gd-coral)' }} />
                            Bot Filter Test
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            runPrediction()
                            selectView('command')
                          }}
                          className="gd-primary w-full"
                        >
                          Forecast ROI for {influencerId} <ArrowRight aria-hidden="true" />
                        </button>
                      </section>
                    </div>

                    {/* Searchable Event Feed Table */}
                    <section className="gd-panel">
                      <header className="gd-panel-head">
                        <div>
                          <h2>Recent Telemetry Events</h2>
                          <p>Real-time stream activity across tracked creators</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="gd-search">
                            <Search aria-hidden="true" />
                            <input
                              type="search"
                              placeholder="Search events"
                              value={tickerQuery}
                              onChange={(e) => setTickerQuery(e.target.value)}
                            />
                          </label>
                          <label className="gd-filter">
                            <Filter aria-hidden="true" />
                            <select
                              aria-label="Filter telemetry events"
                              value={tickerFilter}
                              onChange={(e) =>
                                setTickerFilter(e.target.value as 'all' | 'yt' | 'bot')
                              }
                            >
                              <option value="all">All events</option>
                              <option value="yt">Live YouTube only</option>
                              <option value="bot">Bot spike flagged</option>
                            </select>
                          </label>
                        </div>
                      </header>

                      <div className="gd-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Creator</th>
                              <th>Platform</th>
                              <th>Likes Delta</th>
                              <th>Shares Delta</th>
                              <th>Sentiment</th>
                              <th>Status</th>
                              <th>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTicker.slice(0, 8).map((ev) => (
                              <tr key={ev.event_id} onClick={() => setInfluencerId(ev.influencer_id)}>
                                <td>
                                  <strong>{ev.influencer_id}</strong>
                                </td>
                                <td>{ev.platform}</td>
                                <td>+{ev.likes_delta}</td>
                                <td>+{ev.shares_delta}</td>
                                <td>{ev.estimated_sentiment}</td>
                                <td>
                                  <span
                                    className="gd-status"
                                    data-state={
                                      ev.is_bot_spike
                                        ? 'coral'
                                        : ev.data_source === 'youtube_api_v3'
                                          ? 'teal'
                                          : 'ink'
                                    }
                                  >
                                    <i aria-hidden="true" />
                                    {ev.is_bot_spike
                                      ? 'Bot Flagged'
                                      : ev.data_source === 'youtube_api_v3'
                                        ? 'LIVE YT'
                                        : 'Streamed'}
                                  </span>
                                </td>
                                <td>{ev.time_label}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}

                {/* ─── VIEW 3: ROI ANALYTICS & EXPLAINABILITY ─── */}
                {view === 'analytics' && (
                  <div className="space-y-4">
                    <div className="gd-metric-grid">
                      <article className="gd-metric" data-tone="teal">
                        <div className="gd-metric-head">
                          <span>Net ROI</span>
                          <span className="gd-metric-icon">
                            <TrendingUp />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {prediction
                            ? `${prediction.net_roi_percent >= 0 ? '+' : ''}${prediction.net_roi_percent.toFixed(1)}%`
                            : '—'}
                        </strong>
                        <div className="gd-metric-caption">{targetChannel} projected yield</div>
                      </article>

                      <article className="gd-metric">
                        <div className="gd-metric-head">
                          <span>Gross Revenue</span>
                          <span className="gd-metric-icon">
                            <CircleDollarSign />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {prediction ? formatMoney(prediction.expected_gross_revenue) : '—'}
                        </strong>
                        <div className="gd-metric-caption">On {formatMoney(campaignBudgetInr)} spend</div>
                      </article>

                      <article className="gd-metric">
                        <div className="gd-metric-head">
                          <span>Predicted Orders</span>
                          <span className="gd-metric-icon">
                            <ListChecks />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {prediction
                            ? prediction.predicted_conversions.toLocaleString('en-IN')
                            : '—'}
                        </strong>
                        <div className="gd-metric-caption">CVR {prediction?.predicted_cvr_pct ?? 0}%</div>
                      </article>

                      <article className="gd-metric">
                        <div className="gd-metric-head">
                          <span>Cost Per Click</span>
                          <span className="gd-metric-icon">
                            <ShieldCheck />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {prediction ? formatMoney(prediction.cpc, 2) : '—'}
                        </strong>
                        <div className="gd-metric-caption">Qualified storefront click</div>
                      </article>
                    </div>

                    <div className="gd-analytics-grid">
                      <section className="gd-panel">
                        <header className="gd-panel-head">
                          <div>
                            <h2>Cross-Channel Net ROI Comparison (%)</h2>
                            <p>Nykaa vs. Tira vs. Purplle vs. Direct Storefront for {influencerId}</p>
                          </div>
                        </header>
                        <div style={{ width: '100%', height: 245 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={prediction?.cross_channel_comparison || []}
                              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                              <XAxis dataKey="channel" stroke={chartTickColor} tick={{ fontSize: 11 }} />
                              <YAxis stroke={chartTickColor} tick={{ fontSize: 10 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: theme === 'dark' ? '#1c181a' : '#fffaf5',
                                  borderColor: 'var(--gd-rim)',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  color: 'var(--gd-ink)',
                                }}
                              />
                              <Bar dataKey="net_roi_percent" name="Net ROI (%)" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                                {(prediction?.cross_channel_comparison || []).map((entry) => (
                                  <Cell key={entry.channel} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </section>

                      <section className="gd-panel space-y-4">
                        <header className="gd-panel-head">
                          <div>
                            <h2>Explainable AI Drivers (SHAP)</h2>
                            <p>Factor contribution for current forecast</p>
                          </div>
                        </header>

                        <div className="space-y-3.5">
                          {(prediction?.attributions || []).map((attr) => (
                            <div key={attr.driver} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold">{attr.driver}</span>
                                <strong className="font-bold">{attr.pct}%</strong>
                              </div>
                              <div className="gd-mix-track">
                                <span
                                  className="gd-fill"
                                  style={{
                                    width: `${Math.max(4, attr.pct)}%`,
                                    backgroundColor: attr.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => selectView('command')}
                            className="gd-secondary flex-1"
                          >
                            Adjust Budget &amp; Creator
                          </button>
                          <button
                            type="button"
                            onClick={exportJsonBrief}
                            className="gd-primary flex-1"
                          >
                            <Download aria-hidden="true" />
                            Export Brief
                          </button>
                        </div>
                      </section>
                    </div>

                    {/* Interactive Click-to-Switch Channel Yield Cards */}
                    <section className="gd-panel space-y-3">
                      <header className="gd-panel-head">
                        <div>
                          <h2>Channel Yield Breakdown — Click Any Channel to Recalculate</h2>
                          <p>Switch active storefront channel and re-score predictions instantaneously</p>
                        </div>
                      </header>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(prediction?.cross_channel_comparison || []).map((item) => {
                          const isCurrent = item.channel === targetChannel
                          return (
                            <button
                              key={item.channel}
                              type="button"
                              onClick={() => {
                                const ch = item.channel as TargetChannel
                                setTargetChannel(ch)
                                runPrediction({ target_channel: ch })
                              }}
                              className="p-3.5 rounded-2xl text-left transition-all"
                              style={{
                                background: isCurrent ? 'var(--gd-raised)' : 'var(--gd-inner)',
                                border: `1px solid ${isCurrent ? item.color : 'var(--gd-line)'}`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <strong className="text-sm">{item.channel}</strong>
                                <span
                                  className="text-xs font-extrabold"
                                  style={{ color: item.color }}
                                >
                                  {item.multiplier}×
                                </span>
                              </div>
                              <div
                                className="text-xl font-extrabold mt-2"
                                style={{ color: 'var(--gd-teal)' }}
                              >
                                {item.net_roi_percent >= 0 ? '+' : ''}
                                {item.net_roi_percent.toFixed(1)}%
                              </div>
                              <div className="text-[11px] opacity-75 mt-1">
                                {item.predicted_conversions.toLocaleString('en-IN')} orders ·{' '}
                                {formatMoney(item.expected_gross_revenue)}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  </div>
                )}

                {/* ─── VIEW 4: SAVED SHORTLIST LEDGER ─── */}
                {view === 'shortlist' && (
                  <div className="space-y-4">
                    <div className="gd-metric-grid">
                      <article className="gd-metric" data-tone="teal">
                        <div className="gd-metric-head">
                          <span>Saved Forecasts</span>
                          <span className="gd-metric-icon">
                            <BriefcaseBusiness />
                          </span>
                        </div>
                        <strong className="gd-metric-value">{history.length}</strong>
                        <div className="gd-metric-caption">Persisted for {user?.email || 'brand'}</div>
                      </article>

                      <article className="gd-metric">
                        <div className="gd-metric-head">
                          <span>Top Net ROI</span>
                          <span className="gd-metric-icon">
                            <TrendingUp />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {history.length > 0
                            ? `+${Math.max(...history.map((h) => h.net_roi_percent)).toFixed(1)}%`
                            : '—'}
                        </strong>
                        <div className="gd-metric-caption">Best evaluated creator</div>
                      </article>

                      <article className="gd-metric">
                        <div className="gd-metric-head">
                          <span>Avg Orders</span>
                          <span className="gd-metric-icon">
                            <Users />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {history.length > 0
                            ? Math.round(
                                history.reduce((acc, h) => acc + h.predicted_conversions, 0) /
                                  history.length
                              ).toLocaleString('en-IN')
                            : '—'}
                        </strong>
                        <div className="gd-metric-caption">Across shortlisted campaigns</div>
                      </article>

                      <article className="gd-metric">
                        <div className="gd-metric-head">
                          <span>Total Forecast Rev</span>
                          <span className="gd-metric-icon">
                            <CircleDollarSign />
                          </span>
                        </div>
                        <strong className="gd-metric-value">
                          {history.length > 0
                            ? formatMoney(
                                history.reduce((acc, h) => acc + h.expected_gross_revenue, 0)
                              )
                            : '—'}
                        </strong>
                        <div className="gd-metric-caption">Combined evaluation pipeline</div>
                      </article>
                    </div>

                    <section className="gd-panel">
                      <header className="gd-panel-head">
                        <div>
                          <h2>Campaign Shortlist Ledger</h2>
                          <p>Click any saved evaluation row to inspect details or re-open in Command Center</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="gd-search">
                            <Search aria-hidden="true" />
                            <input
                              type="search"
                              placeholder="Search creator or niche"
                              value={shortlistQuery}
                              onChange={(e) => setShortlistQuery(e.target.value)}
                            />
                          </label>
                          <label className="gd-filter">
                            <Filter aria-hidden="true" />
                            <select
                              aria-label="Filter shortlist channel"
                              value={shortlistChannel}
                              onChange={(e) => setShortlistChannel(e.target.value)}
                            >
                              {['All channels', 'Nykaa', 'Tira', 'Purplle', 'D2C Web'].map((ch) => (
                                <option key={ch}>{ch}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </header>

                      <div className="gd-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Creator</th>
                              <th>Channel</th>
                              <th>Budget</th>
                              <th>Orders</th>
                              <th>Revenue</th>
                              <th>Net ROI</th>
                              <th>Decision</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistory.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="text-center py-6 opacity-70">
                                  No saved evaluations match your filter yet.
                                </td>
                              </tr>
                            ) : (
                              filteredHistory.map((row) => (
                                <tr key={row.id} onClick={() => setModal({ row })}>
                                  <td>
                                    <strong>{row.influencer_id}</strong>
                                    <div className="text-[10px] opacity-70">
                                      {row.social_platform} · {row.product_category}
                                    </div>
                                  </td>
                                  <td>{row.target_channel}</td>
                                  <td>{formatMoney(row.campaign_budget)}</td>
                                  <td>{row.predicted_conversions.toLocaleString('en-IN')}</td>
                                  <td>{formatMoney(row.expected_gross_revenue)}</td>
                                  <td
                                    style={{
                                      fontWeight: 800,
                                      color:
                                        row.net_roi_percent >= 80
                                          ? 'var(--gd-teal)'
                                          : row.net_roi_percent >= 0
                                            ? 'var(--gd-ochre)'
                                            : 'var(--gd-coral)',
                                    }}
                                  >
                                    {row.net_roi_percent >= 0 ? '+' : ''}
                                    {row.net_roi_percent.toFixed(1)}%
                                  </td>
                                  <td>
                                    <span
                                      className="gd-status"
                                      data-state={
                                        row.net_roi_percent >= 80
                                          ? 'teal'
                                          : row.net_roi_percent >= 0
                                            ? 'ochre'
                                            : 'coral'
                                      }
                                    >
                                      <i aria-hidden="true" />
                                      {row.decision_tier}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </main>

          <Dock active={active} select={selectView} />
        </div>

        <footer className="gd-footer">
          <span>
            Signed in as {user?.email || 'Brand Operator'} · {user?.brand_name || 'KALKI Pulse'}
          </span>
          {backgroundCredit && (
            <button type="button" onClick={() => navigate('/')}>
              Return to Landing Page <ArrowUpRight aria-hidden="true" />
            </button>
          )}
        </footer>
      </div>

      {/* ========================================================= */}
      {/* QUICK SEARCH / SCENARIO SWITCHER DIALOG                   */}
      {/* ========================================================= */}
      {modal === 'search' && (
        <Dialog title={`Search ${user?.brand_name || workspaceName}`} close={close}>
          <label className="gd-search w-full mb-3" style={{ minBlockSize: 42 }}>
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Jump to a view or scenario..."
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
            />
          </label>
          <div className="gd-quick-list">
            {views
              .filter((v) =>
                `${v.label} ${v.description}`.toLowerCase().includes(quickQuery.trim().toLowerCase())
              )
              .map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    close()
                    selectView(id)
                  }}
                >
                  <Icon aria-hidden="true" />
                  <div className="flex-1">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </div>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
          </div>
        </Dialog>
      )}

      {/* ========================================================= */}
      {/* NOTIFICATIONS DIALOG                                      */}
      {/* ========================================================= */}
      {modal === 'notifications' && (
        <Dialog title="Workspace Alerts" close={close}>
          <div className="gd-quick-list">
            {botAlertEvents.length > 0 ? (
              botAlertEvents.map((ev) => (
                <button
                  key={ev.event_id}
                  type="button"
                  onClick={() => {
                    close()
                    setInfluencerId(ev.influencer_id)
                    selectView('youtube')
                  }}
                >
                  <ShieldAlert aria-hidden="true" style={{ color: 'var(--gd-coral)' }} />
                  <div className="flex-1">
                    <strong>Bot spike detected · {ev.influencer_id}</strong>
                    <small>
                      +{ev.likes_delta} likes filtered on {ev.platform} at {ev.time_label}
                    </small>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="text-xs opacity-75 py-2">
                All creator engagement streams are healthy — zero anomalous spikes detected.
              </p>
            )}
          </div>
        </Dialog>
      )}

      {/* ========================================================= */}
      {/* SAVED EVALUATION INSPECTOR DIALOG                         */}
      {/* ========================================================= */}
      {typeof modal === 'object' && modal && 'row' in modal && (
        <Dialog title={modal.row.influencer_id} close={close}>
          <div className="space-y-4">
            <span
              className="gd-status"
              data-state={
                modal.row.net_roi_percent >= 80
                  ? 'teal'
                  : modal.row.net_roi_percent >= 0
                    ? 'ochre'
                    : 'coral'
              }
            >
              <i aria-hidden="true" />
              {modal.row.decision_tier}
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div
                className="p-2.5 rounded-xl"
                style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
              >
                <div className="opacity-70">Channel</div>
                <strong className="block mt-1">{modal.row.target_channel}</strong>
              </div>
              <div
                className="p-2.5 rounded-xl"
                style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
              >
                <div className="opacity-70">Orders</div>
                <strong className="block mt-1">
                  {modal.row.predicted_conversions.toLocaleString('en-IN')}
                </strong>
              </div>
              <div
                className="p-2.5 rounded-xl"
                style={{ background: 'var(--gd-inner)', border: '1px solid var(--gd-line)' }}
              >
                <div className="opacity-70">Net ROI</div>
                <strong className="block mt-1" style={{ color: 'var(--gd-teal)' }}>
                  {modal.row.net_roi_percent >= 0 ? '+' : ''}
                  {modal.row.net_roi_percent.toFixed(1)}%
                </strong>
              </div>
            </div>
            <button
              type="button"
              className="gd-primary w-full"
              onClick={() => {
                const r = modal.row
                const plat: SocialPlatform =
                  r.social_platform === 'YouTube' ? 'YouTube' : 'YouTube Shorts'
                close()
                setInfluencerId(r.influencer_id)
                setSocialPlatform(plat)
                setTargetChannel(r.target_channel as TargetChannel)
                setProductCategory(r.product_category as ProductCategory)
                setCampaignBudgetInr(r.campaign_budget)
                setProductPriceInr(r.product_price)
                runPrediction({
                  influencer_id: r.influencer_id,
                  social_platform: plat,
                  target_channel: r.target_channel as TargetChannel,
                  product_category: r.product_category as ProductCategory,
                  campaign_budget: r.campaign_budget,
                  product_price: r.product_price,
                  save_to_history: false,
                })
                selectView('command')
              }}
            >
              Load &amp; Re-Forecast in Command Center <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

export default GlassyDashboard
