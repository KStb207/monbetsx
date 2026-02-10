'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      <div className="text-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 shadow-2xl border border-white/20">
          <h1 className="text-5xl font-bold text-white mb-4 animate-pulse">
            Hi Mon, sei gespannt was kommt! :)
          </h1>
          
          <p className="text-white/70 mt-6 text-sm">
            Etwas Großartiges ist in Arbeit...
          </p>

          {/* Navigation */}
          <div className="mt-8 flex flex-col gap-3">
            <Link 
              href="/matchday"
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition duration-200 text-sm border border-white/30"
            >
              📅 Spieltagsübersicht
            </Link>
            
            <Link 
              href="/admin"
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition duration-200 text-sm border border-white/30"
            >
              🔧 Admin-Bereich
            </Link>

            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition duration-200 text-sm border border-white/30"
            >
              Abmelden
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
}