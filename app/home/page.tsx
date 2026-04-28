'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'gesamt', label: 'Gesamt',  color: 'orange'  },
  { key: 'bl1',    label: '1 BL',    color: 'blue'   },
  { key: 'bl2',    label: '2 BL',    color: 'slate'  },
  { key: 'epl',    label: 'PL',      color: 'purple' },
  { key: 'la_liga',label: 'LaLiga',  color: 'red'    },
  { key: 'serie_a',label: 'Ser A',   color: 'green'  },
  { key: 'ligue_1',label: 'Lig 1',   color: 'indigo' },
] as const

type LeagueKey = typeof LEAGUES[number]['key']
type BetFilter = 'offen' | 'gewonnen' | 'verloren' | 'team'

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
  possibleWin: number
}

interface BetRecord {
  id: number
  match_id: number
  matchday: number
  total_stake: number
  odds: number | null
  payout: number | null
  result: string | null
  is_evaluated: boolean
  home_team_short: string
  away_team_short: string
  home_team_id: number
  away_team_id: number
  league_shortcut: string
  home_goals: number | null
  away_goals: number | null
  home_stake: number
  away_stake: number
}

interface TeamOption {
  id: number
  short_name: string
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
  possibleWin: 0,
})

const PAGE_SIZE = 10

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [allStats, setAllStats] = useState<AllStats>({})
  const [loading, setLoading] = useState(true)
  const [activeLeague, setActiveLeague] = useState<LeagueKey>('gesamt')

  // ─── Wettschein-State ─────────────────────────────────────────────────────
  const [betFilter, setBetFilter] = useState<BetFilter>('offen')
  const [allBets, setAllBets] = useState<BetRecord[]>([])
  const [betsLoading, setBetsLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // ─── Statistiken laden ────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const { data: bets } = await supabase
          .from('bets')
          .select(`*, matches!inner(league_shortcut, is_finished)`)
          .eq('matches.is_finished', true)
          .eq('season', '2025')

        const statsMap: AllStats = {}

        bets?.forEach((bet: any) => {
          const league = bet.matches.league_shortcut
          if (!statsMap[league]) statsMap[league] = emptyStats()
          const stake = bet.total_stake || 0
          const payout = bet.payout || 0
          if (bet.is_evaluated === true) {
            statsMap[league].totalStake += stake
            statsMap[league].totalPayout += payout
            statsMap[league].betCount++
          }
        })

        Object.keys(statsMap).forEach(k => {
          statsMap[k].profit = statsMap[k].totalPayout - statsMap[k].totalStake
        })

        const { data: openBets } = await supabase
          .from('bets')
          .select(`*, matches!inner(league_shortcut, is_finished)`)
          .eq('is_evaluated', false)
          .eq('season', '2025')

        openBets?.forEach((bet: any) => {
          const league = bet.matches.league_shortcut
          if (!statsMap[league]) statsMap[league] = emptyStats()
          statsMap[league].openStake += bet.total_stake || 0
          statsMap[league].openBetCount++
          if (bet.total_stake && bet.odds) {
            statsMap[league].possibleWin += bet.total_stake * bet.odds
          }
        })

        const now = new Date()
        const leagueKeys = ['bl1', 'bl2', 'epl', 'la_liga', 'serie_a', 'ligue_1']
        for (const league of leagueKeys) {
          const { data: upcoming } = await supabase
            .from('matches').select('matchday').eq('league_shortcut', league)
            .eq('season', '2025').gte('match_date', now.toISOString())
            .order('match_date', { ascending: true }).limit(1)
          if (upcoming?.[0]) {
            if (!statsMap[league]) statsMap[league] = emptyStats()
            statsMap[league].nextMatchday = upcoming[0].matchday
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

  // ─── Wettscheine laden wenn Liga oder Filter wechselt ────────────────────
  useEffect(() => {
    if (activeLeague === 'gesamt') {
      setAllBets([])
      setTeamOptions([])
      setSelectedTeamId(null)
      return
    }

    async function fetchBets() {
      setBetsLoading(true)
      setPage(0)
      setSelectedTeamId(null)

      try {
        // Teams für die Liga laden (für Team-Filter Dropdown)
        const { data: teams } = await supabase
          .from('teams')
          .select('id, short_name')
          .eq('league_shortcut', activeLeague)
          .order('short_name', { ascending: true })
        setTeamOptions(teams || [])

        // Alle Wettscheine der Liga laden
        const { data: bets } = await supabase
          .from('bets')
          .select(`
            id, match_id, matchday, total_stake, odds, payout, result, is_evaluated,
            home_stake, away_stake,
            matches!inner(
              league_shortcut, is_finished, home_goals, away_goals,
              home_team:teams!matches_home_team_id_fkey(id, short_name),
              away_team:teams!matches_away_team_id_fkey(id, short_name)
            )
          `)
          .eq('matches.league_shortcut', activeLeague)
          .eq('season', '2025')
          .order('matchday', { ascending: false })

        const mapped: BetRecord[] = (bets || []).map((b: any) => ({
          id: b.id,
          match_id: b.match_id,
          matchday: b.matchday,
          total_stake: b.total_stake || 0,
          odds: b.odds,
          payout: b.payout,
          result: b.result,
          is_evaluated: b.is_evaluated,
          home_team_short: b.matches.home_team?.short_name || '?',
          away_team_short: b.matches.away_team?.short_name || '?',
          home_team_id: b.matches.home_team?.id,
          away_team_id: b.matches.away_team?.id,
          league_shortcut: b.matches.league_shortcut,
          home_goals: b.matches.home_goals ?? null,
          away_goals: b.matches.away_goals ?? null,
          home_stake: b.home_stake || 0,
          away_stake: b.away_stake || 0,
        }))

        setAllBets(mapped)
      } catch (e) {
        console.error('Fehler beim Laden der Wettscheine:', e)
      } finally {
        setBetsLoading(false)
      }
    }

    fetchBets()
  }, [activeLeague])

  // ─── Filter + Paginierung ────────────────────────────────────────────────
  const filteredBets = allBets.filter(b => {
    if (betFilter === 'offen') return !b.is_evaluated
    if (betFilter === 'gewonnen') return b.is_evaluated && b.result === 'x'
    if (betFilter === 'verloren') return b.is_evaluated && b.result !== 'x'
    if (betFilter === 'team' && selectedTeamId) {
      return b.home_team_id === selectedTeamId || b.away_team_id === selectedTeamId
    }
    return true
  })

  const totalPages = Math.ceil(filteredBets.length / PAGE_SIZE)
  const pagedBets = filteredBets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ─── Liga/Filter wechsel → Seite zurücksetzen ────────────────────────────
  useEffect(() => { setPage(0) }, [betFilter, selectedTeamId])

  // ─── Gesamt-Stats ────────────────────────────────────────────────────────
  const getStats = (league: LeagueKey): LeagueStats => {
    if (league === 'gesamt') {
      return Object.keys(allStats).reduce((acc, k) => {
        const s = allStats[k]
        return {
          totalStake: acc.totalStake + s.totalStake,
          totalPayout: acc.totalPayout + s.totalPayout,
          profit: acc.profit + s.profit,
          betCount: acc.betCount + s.betCount,
          openStake: acc.openStake + s.openStake,
          openBetCount: acc.openBetCount + s.openBetCount,
          nextMatchday: 0,
          possibleWin: acc.possibleWin + s.possibleWin,
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

        {/* ── Liga-Tabs ────────────────────────────────────────────────────── */}
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

        {/* Spieltag Badge */}
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

        {/* ── Statistik-Karten ─────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
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
                <span className="font-semibold text-green-700">{formatCurrency(activeStats.possibleWin)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gesamtprofit Banner ───────────────────────────────────────────── */}
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
                <span className="font-semibold text-blue-600">-{formatCurrency(activeStats.openStake)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Wettscheine (nur bei Liga-Auswahl) ───────────────────────────── */}
        {activeLeague !== 'gesamt' && (
          <div className="mt-6">
            <h2 className="text-base font-bold text-slate-800 mb-3">Wettscheine</h2>

            {/* Filter-Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['offen', 'gewonnen', 'verloren', 'team'] as BetFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setBetFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    betFilter === f
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}

              {/* Team-Dropdown */}
              {betFilter === 'team' && (
                <select
                  value={selectedTeamId ?? ''}
                  onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Team wählen...</option>
                  {teamOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.short_name}</option>
                  ))}
                </select>
              )}

              <span className="ml-auto text-xs text-slate-400">
                {filteredBets.length} Einträge
              </span>
            </div>

            {/* Wettschein-Liste */}
            {betsLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
              </div>
            ) : pagedBets.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-400">
                Keine Einträge gefunden
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <div className="col-span-2">Spiel</div>
                    <div className="text-center">Spieltag</div>
                    <div className="text-right">Einsatz</div>
                    <div className="text-right">Quote / Gewinn</div>
                  </div>

                  {/* Zeilen */}
                  {pagedBets.map((bet, idx) => {
                    const won = bet.is_evaluated && bet.result === 'x'
                    const lost = bet.is_evaluated && bet.result !== 'x'
                    const open = !bet.is_evaluated
                    return (
                      <div
                        key={bet.id}
                        className={`grid grid-cols-5 gap-2 px-4 py-3 text-xs sm:text-sm items-center ${
                          idx < pagedBets.length - 1 ? 'border-b border-slate-100' : ''
                        } ${won ? 'bg-green-50' : lost ? 'bg-red-50' : ''}`}
                      >
                        {/* Spiel */}
                        <div className="col-span-2 leading-tight">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-slate-800 ${bet.home_stake > 0 ? 'font-bold' : 'font-medium'}`}>
                              {bet.home_team_short}
                            </span>
                            {bet.home_goals !== null && bet.away_goals !== null ? (
                              <span className="text-slate-500 font-semibold tabular-nums">
                                {bet.home_goals}:{bet.away_goals}
                              </span>
                            ) : (
                              <span className="text-slate-400">vs</span>
                            )}
                            <span className={`text-slate-800 ${bet.away_stake > 0 ? 'font-bold' : 'font-medium'}`}>
                              {bet.away_team_short}
                            </span>
                          </div>
                          <div className="mt-0.5">
                            {open && <span className="text-[10px] text-blue-600 font-semibold">Offen</span>}
                            {won && <span className="text-[10px] text-green-700 font-semibold">✓ Gewonnen</span>}
                            {lost && <span className="text-[10px] text-red-600 font-semibold">✗ Verloren</span>}
                          </div>
                        </div>

                        {/* Spieltag */}
                        <div className="text-center text-slate-500">{bet.matchday}.</div>

                        {/* Einsatz */}
                        <div className="text-right font-semibold text-slate-700">
                          {formatCurrency(bet.total_stake)}
                        </div>

                        {/* Quote / Gewinn */}
                        <div className="text-right">
                          <div className="text-slate-600">{bet.odds ? bet.odds.toFixed(2) : '–'}</div>
                          {won && bet.payout ? (
                            <div className="font-bold text-green-700">{formatCurrency(bet.payout)}</div>
                          ) : open && bet.odds ? (
                            <div className="text-blue-600">{formatCurrency(bet.total_stake * bet.odds)}</div>
                          ) : (
                            <div className="text-slate-400">–</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Paginierung */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        page === 0
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      ← Zurück
                    </button>
                    <span className="text-xs text-slate-500">
                      Seite {page + 1} von {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        page >= totalPages - 1
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Weiter →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}