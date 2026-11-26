import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import KalkiPulseLogo from '../ui/KalkiPulseLogo'
import MagneticButton from '../ui/MagneticButton'
import { useAuth } from '../../context/AuthContext'

export default function Navbar() {
  const nav = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()

  const goToSection = (id: string) => {
    if (location.pathname !== '/') {
      nav('/')
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogout = () => {
    logout()
    nav('/')
  }

  return (
    <header className="fixed top-4 inset-x-4 z-50 glass flex items-center justify-between gap-3 px-4 md:px-6 py-2">
      <KalkiPulseLogo onClick={() => nav('/')} />

      <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-sm muted whitespace-nowrap">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={() => nav('/dashboard')}
              className={`hover:text-white transition-colors whitespace-nowrap ${
                location.pathname === '/dashboard' ? 'text-[#00F0FF] font-semibold' : ''
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => nav('/data-pipeline')}
              className={`hover:text-white transition-colors whitespace-nowrap ${
                location.pathname === '/data-pipeline' ? 'text-[#00F0FF] font-semibold' : ''
              }`}
            >
              Data Cleaning Lab
            </button>
            <button
              type="button"
              onClick={() => goToSection('goals')}
              className="hidden xl:inline-block hover:text-white transition-colors whitespace-nowrap"
            >
              Architecture &amp; Goals
            </button>
          </>
        ) : (
          <>
            {[
              ['Purpose', 'purpose'],
              ['Architecture & Goals', 'goals'],
              ['Benefits', 'benefits'],
            ].map(([label, id]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  goToSection(id)
                }}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => nav('/data-pipeline')}
              className="hover:text-white cursor-pointer transition-colors whitespace-nowrap"
            >
              Data Cleaning Lab
            </button>
          </>
        )}
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        {isAuthenticated && user ? (
          <>
            <button
              type="button"
              onClick={() => nav('/dashboard')}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-emerald-400/35 hover:border-emerald-400/70 transition-colors whitespace-nowrap"
            >
              <span className="size-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] animate-pulse shrink-0" />
              <span className="num text-xs font-semibold text-white max-w-[170px] truncate">
                {user.brand_name}
              </span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/15 hover:border-[#FF2A85]/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="size-3.5 text-[#FF2A85] shrink-0" />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="text-sm cursor-pointer hover:text-white transition-colors whitespace-nowrap"
              onClick={() => nav('/auth')}
            >
              Sign In
            </button>
            <MagneticButton onClick={() => nav('/auth')}>
              Launch Estimator →
            </MagneticButton>
          </>
        )}
      </div>
    </header>
  )
}
