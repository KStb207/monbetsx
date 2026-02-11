'use client'

import Header from '@/components/Header'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Übersicht</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Placeholder Cards */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Statistiken</h3>
            <p className="text-slate-600">Hier kommen deine Wett-Statistiken</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Aktuelle Einsätze</h3>
            <p className="text-slate-600">Übersicht über laufende Wetten</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Gewinn/Verlust</h3>
            <p className="text-slate-600">Deine Performance im Überblick</p>
          </div>
        </div>
      </div>
    </div>
  )
} 
