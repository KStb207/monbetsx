'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

interface Stats {
  bl1TotalStake: number
  bl2TotalStake: number
  totalStake: number
  bl1TotalPayout: number
  bl2TotalPayout: number
  totalPayout: number
  bl1Profit: number
  bl2Profit: number
  totalProfit: number
}

interface CurrentStakes {
  bl1Current: number
  bl2Current: number
  totalCurrent: number
  nextMatchday: number
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [currentStakes, setCurrentStakes] = useState<CurrentStakes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      
      try {
        // 1. Hole alle beendeten Spiele mit Bets
        const { data: bets } = await supabase
          .from('bets')
          .select(`
            *,
            matches!inner(
              league_shortcut,
              is_finished
            )
          `)
          .eq('matches.is_finished', true)
          .eq('season', '2025')
        
        // 2. Berechne Statistiken
        let bl1TotalStake = 0
        let bl2TotalStake = 0
        let bl1TotalPayout = 0
        let bl2TotalPayout = 0
        
        bets?.forEach((bet: any) => {
          const league = bet.matches.league_shortcut
          const stake = bet.total_stake || 0
          const payout = bet.payout || 0
          
          if (league === 'bl1') {
            bl1TotalStake += stake
            bl1TotalPayout += payout
          } else if (league === 'bl2') {
            bl2TotalStake += stake
            bl2TotalPayout += payout
          }
        })
        
        setStats({
          bl1TotalStake,
          bl2TotalStake,
          totalStake: bl1TotalStake + bl2TotalStake,
          bl1TotalPayout,
          bl2TotalPayout,
          totalPayout: bl1TotalPayout + bl2TotalPayout,
          bl1Profit: bl1TotalPayout - bl1TotalStake,
          bl2Profit: bl2TotalPayout - bl2TotalStake,
          totalProfit: (bl1TotalPayout + bl2TotalPayout) - (bl1TotalStake + bl2TotalStake)
        })
        
        // 3. Finde nächsten Spieltag basierend auf Datum
        const now = new Date()
        
        const { data: upcomingMatches } = await supabase
          .from('matches')
          .select('matchday, match_date')
          .gte('match_date', now.toISOString())
          .eq('season', '2025')
          .order('match_date', { ascending: true })
          .order('matchday', { ascending: true })
          .limit(1)
        
        const nextMatchday = upcomingMatches?.[0]?.matchday || 22
        
        const { data: stakes } = await supabase
          .from('team_stakes')
          .select(`
            stake,
            teams!inner(league_shortcut)
          `)
          .eq('matchday', nextMatchday)
          .eq('season', '2025')
        
        let bl1Current = 0
        let bl2Current = 0
        
        stakes?.forEach((s: any) => {
          const stake = s.stake || 0
          if (s.teams.league_shortcut === 'bl1') {
            bl1Current += stake
          } else if (s.teams.league_shortcut === 'bl2') {
            bl2Current += stake
          }
        })
        
        setCurrentStakes({
          bl1Current,
          bl2Current,
          totalCurrent: bl1Current + bl2Current,
          nextMatchday
        })
        
      } catch (error) {
        console.error('Fehler beim Laden:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Übersicht...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Übersicht</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Statistiken Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Statistiken</h3>
            
            {stats && (
              <div className="space-y-4">
                {/* 1. Bundesliga */}
                <div className="border-b border-slate-200 pb-3">
                  <div className="text-sm font-semibold text-blue-700 mb-2">1. Bundesliga</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-600">Einsätze:</span>
                      <span className="font-bold text-slate-800 ml-2">{formatCurrency(stats.bl1TotalStake)}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Gewinne:</span>
                      <span className="font-bold text-green-700 ml-2">{formatCurrency(stats.bl1TotalPayout)}</span>
                    </div>
                  </div>
                </div>
                
                {/* 2. Bundesliga */}
                <div className="border-b border-slate-200 pb-3">
                  <div className="text-sm font-semibold text-slate-700 mb-2">2. Bundesliga</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-600">Einsätze:</span>
                      <span className="font-bold text-slate-800 ml-2">{formatCurrency(stats.bl2TotalStake)}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Gewinne:</span>
                      <span className="font-bold text-green-700 ml-2">{formatCurrency(stats.bl2TotalPayout)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Gesamt */}
                <div className="border-b border-slate-200 pb-3">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Gesamt</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-600">Einsätze:</span>
                      <span className="font-bold text-slate-800 ml-2">{formatCurrency(stats.totalStake)}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Gewinne:</span>
                      <span className="font-bold text-green-700 ml-2">{formatCurrency(stats.totalPayout)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Gesamtgewinn */}
                <div className="bg-slate-50 rounded-lg p-4 mt-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-600 mb-1">Gesamtgewinn</div>
                    <div className={`text-2xl font-bold ${
                      stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(stats.totalProfit)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Aktuelle Einsätze Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Aktuelle Einsätze</h3>
              {currentStakes && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                  Spieltag {currentStakes.nextMatchday}
                </span>
              )}
            </div>
            
            {currentStakes && (
              <div className="space-y-4">
                {/* 1. Bundesliga */}
                <div className="border-b border-slate-200 pb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-blue-700">1. Bundesliga</span>
                    <span className="text-lg font-bold text-slate-800">{formatCurrency(currentStakes.bl1Current)}</span>
                  </div>
                </div>
                
                {/* 2. Bundesliga */}
                <div className="border-b border-slate-200 pb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">2. Bundesliga</span>
                    <span className="text-lg font-bold text-slate-800">{formatCurrency(currentStakes.bl2Current)}</span>
                  </div>
                </div>
                
                {/* Gesamt */}
                <div className="bg-blue-50 rounded-lg p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-800">Gesamt</span>
                    <span className="text-2xl font-bold text-blue-700">{formatCurrency(currentStakes.totalCurrent)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}