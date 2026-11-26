import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Filter,
  HardDrive,
  Layers,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import Navbar from '../components/sections/Navbar'
import SpotlightCard from '../components/ui/SpotlightCard'
import CipherNumber from '../components/ui/CipherNumber'
import MagneticButton from '../components/ui/MagneticButton'
import { NykaaLogo, TiraLogo, PurplleLogo } from '../components/ui/PartnerLogos'
import { useAuth } from '../context/AuthContext'

interface DatasetAudit {
  key: string
  label: string
  raw_rows: number
  clean_rows: number
  duplicates_removed: number
  invalid_rows_removed: number
  dirty_strings_parsed: number
  nulls_before: number
  nulls_imputed: number
  outliers_clipped: number
  memory_mb_before: number
  memory_mb_after: number
  median_ctr_pct: number
  median_conversion_rate_pct: number
  median_roi_pct: number
  raw_sample: Array<Record<string, unknown>>
  clean_sample: Array<Record<string, unknown>>
}

interface HistogramBin {
  bin: string
  before_iqr: number
  after_iqr: number
}

interface ChannelStat {
  channel: string
  key: string
  color: string
  campaigns: number
  median_ctr_pct: number
  median_conversion_rate_pct: number
  median_roi_pct: number
  median_aov_inr: number
  calibration_multiplier: number
}

interface CleaningReport {
  global_kpis: {
    total_raw_rows: number
    total_clean_rows: number
    duplicates_removed: number
    invalid_rows_removed: number
    dirty_strings_parsed: number
    nulls_imputed: number
    outliers_clipped: number
    memory_mb_before: number
    memory_mb_after: number
    memory_reduced_pct: number
  }
  datasets: DatasetAudit[]
  histograms: {
    roi: HistogramBin[]
    ctr: HistogramBin[]
  }
  channel_comparison: ChannelStat[]
}

interface SingleModelMetrics {
  model_file: string
  test_r2: number
  test_mae: number
  test_rmse: number
  parity_max_abs_diff: number
  parity_mean_abs_diff: number
  onnx_latency_mean_ms: number
  onnx_latency_p95_ms: number
  onnx_latency_p99_ms: number
  sub_5ms_verified: boolean
  onnx_size_kb: number
}

interface ShapDriver {
  feature: string
  label: string
  mean_abs_shap: number
  importance_pct: number
}

interface ModelMetricsResponse {
  trained_at: string
  training_rows: number
  test_rows: number
  models: {
    ctr: SingleModelMetrics
    conversion: SingleModelMetrics
    roi: SingleModelMetrics
  }
  shap_importances: ShapDriver[]
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000'

function BrandBadge({ datasetKey }: { datasetKey: string }) {
  if (datasetKey === 'nykaa') return <NykaaLogo className="h-3.5" />
  if (datasetKey === 'tira') return <TiraLogo className="h-3" />
  if (datasetKey === 'purplle') return <PurplleLogo className="h-3.5" />
  return (
    <span className="size-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] inline-block" />
  )
}

export default function DataPipelinePage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [report, setReport] = useState<CleaningReport | null>(null)
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>('nykaa')
  const [inspectorMode, setInspectorMode] = useState<'raw' | 'clean'>('clean')
  const [histMetric, setHistMetric] = useState<'roi' | 'ctr'>('roi')
  const [activeModelKey, setActiveModelKey] = useState<'ctr' | 'conversion' | 'roi'>('ctr')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    Promise.all([
      fetch(`${API_BASE_URL}/api/data-science/cleaning-report`, { headers }).then(async (res) => {
        if (!res.ok) {
          const b = await res.json().catch(() => ({}))
          throw new Error(b.detail || `Failed to load cleaning report (${res.status})`)
        }
        return res.json() as Promise<CleaningReport>
      }),
      fetch(`${API_BASE_URL}/api/data-science/model-metrics`, { headers }).then(async (res) => {
        if (!res.ok) {
          const b = await res.json().catch(() => ({}))
          throw new Error(b.detail || `Failed to load model metrics (${res.status})`)
        }
        return res.json() as Promise<ModelMetricsResponse>
      }),
    ])
      .then(([rep, met]) => {
        if (cancelled) return
        setReport(rep)
        setMetrics(met)
        if (rep.datasets.length > 0) {
          setSelectedDatasetKey(rep.datasets[0].key)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to reach Data Science Gateway.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const selectedDataset = useMemo(() => {
    if (!report) return null
    return report.datasets.find((d) => d.key === selectedDatasetKey) || report.datasets[0] || null
  }, [report, selectedDatasetKey])

  const hygieneChartData = useMemo(() => {
    if (!report) return []
    return report.datasets.map((d) => ({
      name:
        d.key === 'influencer_roi'
          ? 'Influencer ROI'
          : d.key === 'marketing_campaign'
            ? 'Mktg Campaign'
            : d.key.charAt(0).toUpperCase() + d.key.slice(1),
      anomaliesBefore: d.invalid_rows_removed + d.outliers_clipped + d.dirty_strings_parsed + d.nulls_imputed,
      afterCleaning: 0,
      outliersClipped: d.outliers_clipped,
      invalidPurged: d.invalid_rows_removed,
    }))
  }, [report])

  const handleDownloadJson = () => {
    if (!report) return
    const payload = {
      generated_for: user?.brand_name || 'KALKI Pulse',
      cleaning_report: report,
      model_metrics: metrics,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kalki_pulse_cleaning_audit.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const sampleRows = useMemo(() => {
    if (!selectedDataset) return []
    return inspectorMode === 'raw' ? selectedDataset.raw_sample : selectedDataset.clean_sample
  }, [selectedDataset, inspectorMode])

  const sampleCols = useMemo(() => {
    if (sampleRows.length === 0) return []
    return Object.keys(sampleRows[0])
  }, [sampleRows])

  return (
    <div className="min-h-screen bg-[#030306] text-white relative overflow-x-hidden">
      {/* Ambient Radial Aura */}
      <div className="absolute top-0 left-1/4 w-[650px] h-[420px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[520px] h-[420px] bg-[#FF2A85]/10 rounded-full blur-[160px] pointer-events-none" />

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 md:px-12 pt-28 pb-24 relative z-10 space-y-10">
        {/* ========================================================= */}
        {/* 1. TOP TELEMETRY HEADER                                   */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-[11px] font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                KALKI ✦ PULSE / DATA CLEANING &amp; EDA LAB
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/35 num text-[10.5px] font-semibold text-emerald-300">
                <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                5 DATASETS VERIFIED • ONNX READY
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              6-Stage Data Hygiene &amp;{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00F0FF] via-[#38BDF8] to-[#10B981]">
                ONNX Training Audit
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-3xl">
              Programmatic verification across Nykaa, Tira, Purplle, Influencer ROI, and Marketing Campaign datasets. Authenticated workspace:{' '}
              <strong className="text-white">{user?.brand_name}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!report}
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-cyan-400/35 hover:border-[#00F0FF] text-xs font-semibold text-[#00F0FF] hover:text-white transition-all duration-200 disabled:opacity-40"
            >
              <Download className="size-4" />
              <span>Download Audit JSON</span>
            </button>
            <MagneticButton onClick={() => navigate('/dashboard')}>
              Launch Live AI ROI Dashboard →
            </MagneticButton>
          </div>
        </div>

        {/* Loading or Error States */}
        {loading && (
          <div className="p-16 glass rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-4">
            <div className="size-10 rounded-full border-2 border-cyan-400/30 border-t-[#00F0FF] animate-spin" />
            <div className="num text-xs tracking-[0.24em] text-cyan-300 uppercase">
              STREAMING AUDIT ARTIFACTS FROM FASTAPI GATEWAY...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="p-6 rounded-2xl bg-[#FF2A85]/12 border border-[#FF2A85]/40 text-rose-200 flex items-start gap-3">
            <AlertCircle className="size-5 text-[#FF2A85] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">Telemetry Unavailable</div>
              <div className="text-xs mt-1 num">{error}</div>
            </div>
          </div>
        )}

        {report && metrics && !loading && (
          <>
            {/* ========================================================= */}
            {/* 2. 5 ANIMATED SUMMARY KPI CARDS                           */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <SpotlightCard className="p-5 glass rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="num text-[10px] tracking-widest uppercase">Raw → Clean Rows</span>
                  <Database className="size-4 text-[#00F0FF]" />
                </div>
                <div className="text-xl xl:text-2xl font-extrabold text-white num">
                  <CipherNumber value={report.global_kpis.total_clean_rows.toLocaleString('en-IN')} />
                </div>
                <div className="num text-[10.5px] text-slate-400">
                  From <span className="text-slate-200">{report.global_kpis.total_raw_rows.toLocaleString('en-IN')}</span> raw rows
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5 glass rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="num text-[10px] tracking-widest uppercase">Invalid / Dups Purged</span>
                  <ShieldCheck className="size-4 text-[#FF2A85]" />
                </div>
                <div className="text-xl xl:text-2xl font-extrabold text-[#FF2A85] num">
                  <CipherNumber
                    value={(
                      report.global_kpis.duplicates_removed + report.global_kpis.invalid_rows_removed
                    ).toLocaleString('en-IN')}
                  />
                </div>
                <div className="num text-[10.5px] text-slate-400">
                  {report.global_kpis.duplicates_removed} dups · {report.global_kpis.invalid_rows_removed.toLocaleString('en-IN')} impossible bot rows
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5 glass rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="num text-[10px] tracking-widest uppercase">Nulls &amp; Dirty Parsed</span>
                  <Sparkles className="size-4 text-sky-400" />
                </div>
                <div className="text-xl xl:text-2xl font-extrabold text-cyan-300 num">
                  <CipherNumber
                    value={(
                      report.global_kpis.nulls_imputed + report.global_kpis.dirty_strings_parsed
                    ).toLocaleString('en-IN')}
                  />
                </div>
                <div className="num text-[10.5px] text-slate-400">
                  {report.global_kpis.nulls_imputed} nulls · {report.global_kpis.dirty_strings_parsed.toLocaleString('en-IN')} dirty strings
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5 glass rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="num text-[10px] tracking-widest uppercase">IQR Outliers Clipped</span>
                  <Filter className="size-4 text-[#F59E0B]" />
                </div>
                <div className="text-xl xl:text-2xl font-extrabold text-[#F59E0B] num">
                  <CipherNumber value={report.global_kpis.outliers_clipped.toLocaleString('en-IN')} />
                </div>
                <div className="num text-[10.5px] text-slate-400">
                  1.5× IQR fence stabilized
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5 glass rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="num text-[10px] tracking-widest uppercase">Memory Reduced</span>
                  <HardDrive className="size-4 text-[#10B981]" />
                </div>
                <div className="text-xl xl:text-2xl font-extrabold text-[#10B981] num">
                  <CipherNumber value={`${report.global_kpis.memory_reduced_pct}%`} />
                </div>
                <div className="num text-[10.5px] text-slate-400">
                  {report.global_kpis.memory_mb_before} MB → {report.global_kpis.memory_mb_after} MB
                </div>
              </SpotlightCard>
            </div>

            {/* ========================================================= */}
            {/* 3. DATASET-BY-DATASET AUDIT MATRIX                        */}
            {/* ========================================================= */}
            <SpotlightCard className="p-6 sm:p-8 glass rounded-3xl border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div>
                  <span className="num text-[11px] font-bold tracking-widest text-cyan-300 uppercase">
                    MULTI-SOURCE AUDIT MATRIX
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                    Dataset-by-Dataset Hygiene &amp; Memory Compression
                  </h2>
                </div>
                <span className="num text-xs text-slate-400">
                  Click any dataset row to inspect its 10-row Raw vs. Clean delta below
                </span>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 num text-[10.5px] uppercase tracking-wider text-slate-400">
                      <th className="py-3 pr-4">Dataset Source</th>
                      <th className="py-3 px-3 text-right">Raw Rows</th>
                      <th className="py-3 px-3 text-right">Clean Rows</th>
                      <th className="py-3 px-3 text-right">Purged</th>
                      <th className="py-3 px-3 text-right">Strings Parsed</th>
                      <th className="py-3 px-3 text-right">IQR Clipped</th>
                      <th className="py-3 px-3 text-right">Memory Δ</th>
                      <th className="py-3 pl-3 text-right">Med. ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs">
                    {report.datasets.map((d) => {
                      const active = d.key === selectedDatasetKey
                      return (
                        <tr
                          key={d.key}
                          onClick={() => setSelectedDatasetKey(d.key)}
                          className={`cursor-pointer transition-colors ${
                            active
                              ? 'bg-cyan-500/10 text-white'
                              : 'hover:bg-white/[0.03] text-slate-300'
                          }`}
                        >
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-16 flex items-center justify-start shrink-0">
                                <BrandBadge datasetKey={d.key} />
                              </div>
                              <span className="font-semibold text-white">{d.label}</span>
                              {active && (
                                <span className="num text-[9px] px-2 py-0.5 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40">
                                  INSPECTING
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right num">{d.raw_rows.toLocaleString('en-IN')}</td>
                          <td className="py-3.5 px-3 text-right num text-emerald-400 font-semibold">
                            {d.clean_rows.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-3 text-right num text-[#FF2A85]">
                            {(d.duplicates_removed + d.invalid_rows_removed).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-3 text-right num text-cyan-300">
                            {d.dirty_strings_parsed.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-3 text-right num text-[#F59E0B]">
                            {d.outliers_clipped.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-3 text-right num text-slate-300">
                            {d.memory_mb_before} → <strong className="text-emerald-400">{d.memory_mb_after} MB</strong>
                          </td>
                          <td className="py-3.5 pl-3 text-right num font-bold text-white">
                            {d.median_roi_pct}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SpotlightCard>

            {/* ========================================================= */}
            {/* 4. INTERACTIVE BEFORE VS. AFTER CHARTS (RECHARTS)         */}
            {/* ========================================================= */}
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Chart 1: Anomalies Eliminated (Before vs After) */}
              <SpotlightCard className="lg:col-span-6 p-6 glass rounded-3xl border border-white/10">
                <div className="pb-4 border-b border-white/10 mb-5">
                  <span className="num text-[10.5px] font-bold tracking-widest text-[#FF2A85] uppercase">
                    STAGE 1–5 HYGIENE VERIFICATION
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">
                    Dirty Values, Invalid Rows &amp; Outliers Eliminated
                  </h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hygieneChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: 'rgba(0,240,255,0.35)',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="anomaliesBefore"
                        name="Raw Anomalies / Dirty Strings"
                        fill="#FF2A85"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="outliersClipped"
                        name="IQR Outliers Stabilized"
                        fill="#F59E0B"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SpotlightCard>

              {/* Chart 2: IQR Outlier Removal Distribution */}
              <SpotlightCard className="lg:col-span-6 p-6 glass rounded-3xl border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10 mb-5">
                  <div>
                    <span className="num text-[10.5px] font-bold tracking-widest text-[#00F0FF] uppercase">
                      STAGE 5 // IQR FENCE CLIPPING
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">
                      Distribution Before vs. After IQR Clipping
                    </h3>
                  </div>

                  <div className="flex p-1 rounded-full bg-white/[0.04] border border-white/10">
                    {(['roi', 'ctr'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setHistMetric(m)}
                        className={`px-3 py-1 rounded-full num text-[11px] font-semibold uppercase transition-colors ${
                          histMetric === m
                            ? 'bg-[#00F0FF] text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={histMetric === 'roi' ? report.histograms.roi : report.histograms.ctr}
                      margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="beforeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF2A85" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#FF2A85" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="afterGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="bin" stroke="#94A3B8" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: 'rgba(0,240,255,0.35)',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="before_iqr"
                        name="Before IQR (Bot Tail)"
                        stroke="#FF2A85"
                        fill="url(#beforeGrad)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="after_iqr"
                        name="After IQR (Stabilized)"
                        stroke="#00F0FF"
                        fill="url(#afterGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SpotlightCard>
            </div>

            {/* Chart 3: Nykaa vs. Tira vs. Purplle Baseline Calibration */}
            <SpotlightCard className="p-6 sm:p-8 glass rounded-3xl border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10 mb-6">
                <div>
                  <span className="num text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
                    STAGE 6 // COMMERCE BASELINES
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    Nykaa vs. Tira vs. Purplle Empirical Calibration Benchmarks
                  </h3>
                </div>
                <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10">
                  <NykaaLogo className="h-3.5" />
                  <TiraLogo className="h-3" />
                  <PurplleLogo className="h-3.5" />
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.channel_comparison} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="channel" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: 'rgba(0,240,255,0.35)',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="median_ctr_pct" name="Median CTR (%)" fill="#00F0FF" radius={[6, 6, 0, 0]} />
                      <Bar
                        dataKey="median_conversion_rate_pct"
                        name="Median Conv. Rate (%)"
                        fill="#10B981"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar dataKey="median_roi_pct" name="Median Net ROI (%)" fill="#FC2779" radius={[6, 6, 0, 0]}>
                        {report.channel_comparison.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-5 space-y-3">
                  {report.channel_comparison.map((ch) => (
                    <div
                      key={ch.key}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <BrandBadge datasetKey={ch.key} />
                        <div className="num text-[11px] text-slate-400">
                          {ch.campaigns.toLocaleString('en-IN')} campaigns · AOV ₹{ch.median_aov_inr}
                        </div>
                      </div>
                      <div className="text-right num">
                        <div className="text-lg font-extrabold text-white">
                          {ch.calibration_multiplier}×
                        </div>
                        <div className="text-[10px] text-emerald-400">
                          Conv {ch.median_conversion_rate_pct}% · ROI {ch.median_roi_pct}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SpotlightCard>

            {/* ========================================================= */}
            {/* 5. RAW VS. CLEANED DATA INSPECTOR                         */}
            {/* ========================================================= */}
            {selectedDataset && (
              <SpotlightCard className="p-6 sm:p-8 glass rounded-3xl border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
                  <div>
                    <span className="num text-[11px] font-bold tracking-widest text-cyan-300 uppercase">
                      ROW-LEVEL FORENSIC INSPECTOR
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {selectedDataset.label} — 10-Row Sample ({inspectorMode === 'raw' ? 'Messy Raw CSV' : 'Cleaned Feature Table'})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Dataset Pill Switcher */}
                    <select
                      aria-label="Select Dataset"
                      value={selectedDatasetKey}
                      onChange={(e) => setSelectedDatasetKey(e.target.value)}
                      className="rounded-full bg-[#070a12] border border-white/15 px-3.5 py-1.5 text-xs num text-white outline-none focus:border-[#00F0FF]"
                    >
                      {report.datasets.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>

                    {/* Segmented Toggle */}
                    <div className="flex p-1 rounded-full bg-white/[0.04] border border-white/10">
                      {(
                        [
                          { id: 'raw', label: 'Messy Raw CSV' },
                          { id: 'clean', label: 'Cleaned Feature Table' },
                        ] as const
                      ).map((tab) => {
                        const active = inspectorMode === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setInspectorMode(tab.id)}
                            className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                              active ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="inspectorTabPill"
                                className="absolute inset-0 rounded-full bg-[#00F0FF]"
                              />
                            )}
                            <span className="relative z-10">{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4 max-h-[380px] [scrollbar-color:rgba(0,240,255,0.3)_transparent] [scrollbar-width:thin]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#070a13] z-10">
                      <tr className="border-b border-white/10 num text-[10px] uppercase tracking-wider text-cyan-300">
                        {sampleCols.map((col) => (
                          <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05] num text-[11px]">
                      {sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.03]">
                          {sampleCols.map((col) => (
                            <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-300">
                              {row[col] === null || row[col] === undefined ? (
                                <span className="text-[#FF2A85]">null</span>
                              ) : (
                                String(row[col])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SpotlightCard>
            )}

            {/* ========================================================= */}
            {/* 6. XGBOOST + ONNX READINESS & SHAP EXPLAINABILITY         */}
            {/* ========================================================= */}
            <SpotlightCard className="p-6 sm:p-8 glass rounded-3xl border border-white/10 relative overflow-hidden">
              <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Cpu className="size-4 text-[#10B981]" />
                    <span className="num text-[11px] font-bold tracking-widest text-[#10B981] uppercase">
                      XGBOOST + ONNX RUNTIME VERIFICATION
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-1">
                    Model Readiness, Numerical Parity &amp; SHAP Feature Drivers
                  </h2>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/12 border border-emerald-400/40 num text-xs font-bold text-emerald-300">
                  <Zap className="size-4" />
                  <span>
                    LIVE ONNX LATENCY: {metrics.models[activeModelKey].onnx_latency_mean_ms}ms (&lt; 5ms SLA VERIFIED)
                  </span>
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-8 mt-6 relative z-10">
                {/* Left 5 cols: Model Selector + Parity & Metrics */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                    {(
                      [
                        { id: 'ctr', label: 'CTR Model' },
                        { id: 'conversion', label: 'Conv. Model' },
                        { id: 'roi', label: 'ROI Model' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveModelKey(m.id)}
                        className={`py-2 rounded-lg num text-xs font-semibold transition-colors ${
                          activeModelKey === m.id
                            ? 'bg-[#00F0FF] text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="num text-[10px] text-slate-400 uppercase">Test R² Score</div>
                      <div className="text-2xl font-extrabold text-[#00F0FF] num mt-1">
                        {metrics.models[activeModelKey].test_r2}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="num text-[10px] text-slate-400 uppercase">Test MAE</div>
                      <div className="text-2xl font-extrabold text-white num mt-1">
                        {metrics.models[activeModelKey].test_mae}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="num text-[10px] text-slate-400 uppercase">XGBoost Parity Δ</div>
                      <div className="text-xl font-extrabold text-[#10B981] num mt-1">
                        {metrics.models[activeModelKey].parity_max_abs_diff}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="num text-[10px] text-slate-400 uppercase">P99 ONNX Latency</div>
                      <div className="text-xl font-extrabold text-[#10B981] num mt-1">
                        {metrics.models[activeModelKey].onnx_latency_p99_ms}ms
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#050811]/80 border border-white/10 flex flex-wrap items-center justify-between gap-3 num text-xs">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Layers className="size-4 text-cyan-300 shrink-0" />
                      {metrics.models[activeModelKey].model_file}
                    </span>
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      {metrics.models[activeModelKey].onnx_size_kb} KB · {metrics.training_rows.toLocaleString('en-IN')} train rows
                    </span>
                  </div>
                </div>

                {/* Right 7 cols: SHAP Top Feature Drivers */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="num text-xs font-bold tracking-wider text-white uppercase flex items-center gap-2">
                        <Activity className="size-4 text-[#00F0FF]" />
                        Global SHAP Feature Importance Drivers (TreeExplainer)
                      </span>
                      <span className="num text-[11px] text-slate-400">
                        n = 2,000 test sample
                      </span>
                    </div>

                    <div className="space-y-3">
                      {metrics.shap_importances.slice(0, 6).map((driver, idx) => {
                        const colors = ['#00F0FF', '#10B981', '#FF2A85', '#38BDF8', '#F59E0B', '#C084FC']
                        const barColor = colors[idx % colors.length]
                        return (
                          <div key={driver.feature} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-200 font-medium">{driver.label}</span>
                              <span className="num font-bold text-white">
                                {driver.importance_pct}%{' '}
                                <span className="text-slate-400 font-normal">
                                  (|φ|={driver.mean_abs_shap})
                                </span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.max(4, driver.importance_pct)}%`,
                                  backgroundColor: barColor,
                                  boxShadow: `0 0 10px ${barColor}80`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <span className="num text-xs text-slate-400">
                      All 3 ONNX graphs verified with CPUExecutionProvider
                    </span>
                    <MagneticButton onClick={() => navigate('/dashboard')}>
                      Launch Live AI ROI Dashboard →
                    </MagneticButton>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </>
        )}
      </main>
    </div>
  )
}
