import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import DataPipelinePage from './pages/DataPipelinePage'
import Demo from '@/components/ui/demo'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/forge" element={<Demo />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/data-pipeline"
          element={
            <ProtectedRoute>
              <DataPipelinePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
