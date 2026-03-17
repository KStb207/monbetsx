'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'gesamt', label: 'Gesamt',  color: 'slate'  },
  { key: 'bl1',    label: '1. BL',   color: 'blue'   },
  { key: 'bl2',    label: '2. BL',   color: 'slate'  },
  { key: 'epl',    label: 'PL',      color: 'purple' },
  { key: 'la_liga',label: 'La Liga', color: 'red'    },
  { key: 'serie_a',label: 'Serie A', color: 'green'  },
  { key: 'ligue_1',label: 'Ligue 1', color: 'indigo' },
] as const

type LeagueKey = typeof LEAGUES[number]['key']

const COUNTRY_COLORS: Record<string, { active: string; inactive: string; border: string }> = {
  gesamt:  { active: 'linear-gradient(135deg, #334155 0%, #475569 100%)',                                                                                                                                                                              inactive: 'linear-gradient(135deg, rgba(51,65,85,0.08) 0%, rgba(71,85,105,0.08) 100%)',                                                                                                                                                               border: '#475569' },
  bl1:     { active: 'linear-gradient(135deg, #1a1a1a 33%, #CC0000 33%, #CC0000 66%, #FFCE00 66%)',                                                                                                                                                    inactive: 'linear-gradient(135deg, rgba(26,26,26,0.08) 33%, rgba(204,0,0,0.08) 33%, rgba(204,0,0,0.08) 66%, rgba(255,206,0,0.08) 66%)',                                                                                                              border: '#CC0000' },
  bl2:     { active: 'linear-gradient(135deg, #1a1a1a 33%, #CC0000 33%, #CC0000 66%, #FFCE00 66%)',                                                                                                                                                    inactive: 'linear-gradient(135deg, rgba(26,26,26,0.08) 33%, rgba(204,0,0,0.08) 33%, rgba(204,0,0,0.08) 66%, rgba(255,206,0,0.08) 66%)',                                                                                                              border: '#CC0000' },
  epl:     { active: 'linear-gradient(#CF101A, #CF101A) center/33% 100% no-repeat, linear-gradient(#CF101A, #CF101A) center/100% 33% no-repeat, #f5f5f5',  inactive: 'linear-gradient(rgba(207,16,26,0.25), rgba(207,16,26,0.25)) center/33% 100% no-repeat, linear-gradient(rgba(207,16,26,0.25), rgba(207,16,26,0.25)) center/100% 33% no-repeat, #f9f9f9', border: '#CF101A' },
  la_liga: { active: 'linear-gradient(135deg, #AA151B 25%, #F1BF00 25%, #F1BF00 75%, #AA151B 75%)',                                                                                                                                                   inactive: 'linear-gradient(135deg, rgba(170,21,27,0.1) 25%, rgba(241,191,0,0.1) 25%, rgba(241,191,0,0.1) 75%, rgba(170,21,27,0.1) 75%)',                                                                                                             border: '#AA151B' },
  serie_a: { active: 'linear-gradient(135deg, #009246 33%, #f5f5f5 33%, #f5f5f5 66%, #CE2B37 66%)',                                                                                                                                                   inactive: 'linear-gradient(135deg, rgba(0,146,70,0.1) 33%, rgba(245,245,245,0.3) 33%, rgba(245,245,245,0.3) 66%, rgba(206,43,55,0.1) 66%)',                                                                                                          border: '#009246' },
  ligue_1: { active: 'linear-gradient(135deg, #002395 33%, #f5f5f5 33%, #f5f5f5 66%, #ED2939 66%)',                                                                                                                                                   inactive: 'linear-gradient(135deg, rgba(0,35,149,0.1) 33%, rgba(245,245,245,0.3) 33%, rgba(245,245,245,0.3) 66%, rgba(237,41,57,0.1) 66%)',                                                                                                          border: '#002395' },
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface LeagueStats {
  totalStake: number
  totalPayout: number
  profit: number
  betCount: number
  openStake: number
  openBetCount: number
  nextMatchday: number
}

type AllStats = Record<string, LeagueStats>

const emptyStats = (): LeagueStats => ({
  totalStake: 0,
  totalPayout: 0,
  profit: 0,
  betCount: 0,
  openStake: 0,
  openBetCount: 0,
  nextMatchday: 0,
})

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [allStats, setAllStats] = useState<AllStats>({})
  const [loading, setLoading] = useState(true)
  const [activeLeague, setActiveLeague] = useState<LeagueKey>('gesamt')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // 1. Abgeschlossene Bets
        const { data: bets } = await supabase
          .from('bets')
          .select(`
            *,
            matches!inner(league_shortcut, is_finished)
          `)
          .eq('matches.is_finished', true)
          .eq('season', '2025')

        const statsMap: AllStats = {}

        bets?.forEach((bet: any) => {
          const league = bet.matches.league_shortcut
          if (!statsMap[league]) statsMap[league] = emptyStats()

          const stake = bet.total_stake || 0
          const payout = bet.payout || 0
          const evaluated = bet.is_evaluated === true

          if (evaluated) {
            statsMap[league].totalStake += stake
            statsMap[league].totalPayout += payout
            statsMap[league].betCount++
          }
        })

        // Profit berechnen
        Object.keys(statsMap).forEach(k => {
          statsMap[k].profit = statsMap[k].totalPayout - statsMap[k].totalStake
        })

        // 2. Offene Bets (nicht evaluiert)
        const { data: openBets } = await supabase
          .from('bets')
          .select(`
            *,
            matches!inner(league_shortcut, is_finished)
          `)
          .eq('is_evaluated', false)
          .eq('season', '2025')

        openBets?.forEach((bet: any) => {
          const league = bet.matches.league_shortcut
          if (!statsMap[league]) statsMap[league] = emptyStats()
          statsMap[league].openStake += bet.total_stake || 0
          statsMap[league].openBetCount++
        })

        // 3. Nächster Spieltag pro Liga
        const now = new Date()
        const leagueKeys = ['bl1', 'bl2', 'epl', 'la_liga', 'serie_a', 'ligue_1']

        for (const league of leagueKeys) {
          const { data: upcoming } = await supabase
            .from('matches')
            .select('matchday')
            .eq('league_shortcut', league)
            .eq('season', '2025')
            .gte('match_date', now.toISOString())
            .order('match_date', { ascending: true })
            .limit(1)

          if (upcoming?.[0]) {
            if (!statsMap[league]) statsMap[league] = emptyStats()
            statsMap[league].nextMatchday = upcoming[0].matchday
          }
        }

        // 4. Aktuelle Einsätze (team_stakes) pro Liga
        for (const league of leagueKeys) {
          const matchday = statsMap[league]?.nextMatchday
          if (!matchday) continue

          const { data: stakes } = await supabase
            .from('team_stakes')
            .select(`stake, teams!inner(league_shortcut)`)
            .eq('matchday', matchday)
            .eq('season', '2025')
            .eq('teams.league_shortcut', league)

          if (stakes) {
            if (!statsMap[league]) statsMap[league] = emptyStats()
            // openStake aus team_stakes nur wenn keine offenen bets
            // Wir lassen openStake aus bets Tabelle (oben schon gesetzt)
          }
        }

        setAllStats(statsMap)
      } catch (error) {
        console.error('Fehler beim Laden:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)

  // Gesamt-Stats aggregieren
  const getStats = (league: LeagueKey): LeagueStats => {
    if (league === 'gesamt') {
      const keys = Object.keys(allStats)
      return keys.reduce((acc, k) => {
        const s = allStats[k]
        return {
          totalStake: acc.totalStake + s.totalStake,
          totalPayout: acc.totalPayout + s.totalPayout,
          profit: acc.profit + s.profit,
          betCount: acc.betCount + s.betCount,
          openStake: acc.openStake + s.openStake,
          openBetCount: acc.openBetCount + s.openBetCount,
          nextMatchday: 0,
        }
      }, emptyStats())
    }
    return allStats[league] ?? emptyStats()
  }

  const activeStats = getStats(activeLeague)
  const colors = COUNTRY_COLORS[activeLeague]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8">
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

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-5">Übersicht</h1>

        {/* Liga-Tabs */}
        <div className="grid grid-cols-7 gap-1 mb-6">
          {LEAGUES.map(league => {
            const isActive = activeLeague === league.key
            const c = COUNTRY_COLORS[league.key]
            return (
              <button
                key={league.key}
                onClick={() => setActiveLeague(league.key as LeagueKey)}
                style={{
                  background: isActive ? c.active : c.inactive,
                  borderColor: isActive ? c.border : '#d1d5db',
                  boxShadow: isActive ? `0 0 0 1px ${c.border}` : undefined,
                }}
                className="px-1 py-2 rounded-lg font-semibold text-[10px] sm:text-xs transition whitespace-nowrap border text-slate-800 hover:opacity-90"
              >
                {league.label}
              </button>
            )
          })}
        </div>

        {/* Spieltag Badge (nicht bei Gesamt) */}
        {activeLeague !== 'gesamt' && activeStats.nextMatchday > 0 && (
          <div className="mb-4">
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: `${colors.border}20`, color: colors.border, border: `1px solid ${colors.border}40` }}
            >
              Nächster Spieltag: {activeStats.nextMatchday}
            </span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">

          {/* ── Abgeschlossene Wetten ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
              <h3 className="text-base font-bold text-slate-800">Abgeschlossene Wetten</h3>
              <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {activeStats.betCount} Wetten
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Gesamteinsatz</span>
                <span className="font-semibold text-slate-800">{formatCurrency(activeStats.totalStake)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Gesamtgewinn</span>
                <span className="font-semibold text-green-700">{formatCurrency(activeStats.totalPayout)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Profit / Verlust</span>
                  <span className={`text-xl font-bold ${activeStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {activeStats.profit >= 0 ? '+' : ''}{formatCurrency(activeStats.profit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Offene Wetten ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <h3 className="text-base font-bold text-slate-800">Offene Wetten</h3>
              <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {activeStats.openBetCount} Wetten
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Ausstehender Einsatz</span>
                <span className="font-semibold text-slate-800">{formatCurrency(activeStats.openStake)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Möglicher Gewinn</span>
                <span className="font-semibold text-slate-400">–</span>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {activeStats.openBetCount > 0 ? 'Ausstehend' : 'Keine offenen Wetten'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Gesamtprofit Banner ────────────────────────────────────────────── */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Gesamtprofit inkl. offene Wetten</div>
              <div className={`text-3xl font-bold ${(activeStats.profit - activeStats.openStake) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(activeStats.profit - activeStats.openStake) >= 0 ? '+' : ''}
                {formatCurrency(activeStats.profit - activeStats.openStake)}
              </div>
            </div>
            <div className="flex gap-4 text-sm text-slate-500">
              <div>
                <span className="block text-xs text-slate-400">Realisiert</span>
                <span className={`font-semibold ${activeStats.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {activeStats.profit >= 0 ? '+' : ''}{formatCurrency(activeStats.profit)}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Offen</span>
                <span className="font-semibold text-blue-600">
                  -{formatCurrency(activeStats.openStake)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}