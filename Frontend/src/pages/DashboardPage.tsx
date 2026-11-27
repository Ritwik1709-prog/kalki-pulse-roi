import React from 'react'
import GlassyDashboard from '../components/ui/glassy-dashboard'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()
  return (
    <GlassyDashboard
      workspaceName={user?.brand_name || 'KALKI PULSE'}
      panelFrost={14}
      initialTheme="dark"
    />
  )
}
