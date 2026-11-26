import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030306] text-white flex flex-col items-center justify-center gap-4 px-6">
        <div className="size-10 rounded-full border-2 border-cyan-400/30 border-t-[#00F0FF] animate-spin" />
        <div className="num text-xs tracking-[0.25em] text-cyan-300 uppercase">
          VERIFYING SESSION TELEMETRY...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const intended = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/auth" replace state={{ from: intended }} />
  }

  return <>{children}</>
}
