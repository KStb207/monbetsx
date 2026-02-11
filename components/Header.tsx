'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3 sm:py-0">
          {/* Desktop & Tablet Layout */}
          <div className="hidden sm:flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/home" className="text-2xl font-bold text-slate-800">
              MonBetsX
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              <Link
                href="/home"
                className={`text-sm font-medium transition ${
                  pathname === '/home'
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Übersicht
              </Link>
              <Link
                href="/teams"
                className={`text-sm font-medium transition ${
                  pathname === '/teams'
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teams
              </Link>
              <Link
                href="/bets"
                className={`text-sm font-medium transition ${
                  pathname === '/bets'
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Wetten
              </Link>
              <Link
                href="/statistics"
                className={`text-sm font-medium transition ${
                  pathname === '/statistics'
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Statistik
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 rounded-lg transition"
              >
                Logout
              </button>
            </nav>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden">
            {/* Top Row: Logo + Logout */}
            <div className="flex items-center justify-between mb-3">
              <Link href="/home" className="text-xl font-bold text-slate-800">
                MonBetsX
              </Link>
              
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-600 hover:bg-slate-700 rounded-lg transition"
              >
                Logout
              </button>
            </div>

            {/* Bottom Row: Navigation */}
            <nav className="flex items-center justify-between gap-1">
              <Link
                href="/home"
                className={`flex-1 text-center px-2 py-2 text-xs font-medium transition rounded-lg ${
                  pathname === '/home'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Übersicht
              </Link>
              <Link
                href="/teams"
                className={`flex-1 text-center px-2 py-2 text-xs font-medium transition rounded-lg ${
                  pathname === '/teams'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Teams
              </Link>
              <Link
                href="/bets"
                className={`flex-1 text-center px-2 py-2 text-xs font-medium transition rounded-lg ${
                  pathname === '/bets'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Wetten
              </Link>
              <Link
                href="/statistics"
                className={`flex-1 text-center px-2 py-2 text-xs font-medium transition rounded-lg ${
                  pathname === '/statistics'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Statistik
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}