'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'bl1',     label: '1. BL',   name: '1. Bundesliga',  color: 'blue',   totalMatchdays: 34 },
  { key: 'bl2',     label: '2. BL',   name: '2. Bundesliga',  color: 'slate',  totalMatchdays: 34 },
  { key: 'epl',     label: 'PL',      name: 'Premier League', color: 'purple', totalMatchdays: 38 },
  { key: 'la_liga', label: 'La Liga', name: 'La Liga',        color: 'red',    totalMatchdays: 38 },
  { key: 'serie_a', label: 'Serie A', name: 'Serie A',        color: 'green',  totalMatchdays: 38 },
  { key: 'ligue_1', label: 'Ligue 1', name: 'Ligue 1',        color: 'indigo', totalMatchdays: 34 },
] as const

type LeagueKey = typeof LEAGUES[number]['key']
type SortMode = 'az' | 'az-desc' | 'draws' | 'without'

// ─── Länderfarben für Tabs ─────────────────────────────────────────────────────
const COUNTRY_COLORS: Record<string, { active: string; inactive: string; border: string }> = {
  bl1:     { active: 'linear-gradient(135deg, #1a1a1a 33%, #CC0000 33%, #CC0000 66%, #FFCE00 66%)',     inactive: 'linear-gradient(135deg, rgba(26,26,26,0.08) 33%, rgba(204,0,0,0.08) 33%, rgba(204,0,0,0.08) 66%, rgba(255,206,0,0.08) 66%)',     border: '#CC0000' },
  bl2:     { active: 'linear-gradient(135deg, #1a1a1a 33%, #CC0000 33%, #CC0000 66%, #FFCE00 66%)',     inactive: 'linear-gradient(135deg, rgba(26,26,26,0.08) 33%, rgba(204,0,0,0.08) 33%, rgba(204,0,0,0.08) 66%, rgba(255,206,0,0.08) 66%)',     border: '#CC0000' },
  epl:     { active: 'linear-gradient(#CF101A, #CF101A) center/33% 100% no-repeat, linear-gradient(#CF101A, #CF101A) center/100% 33% no-repeat, #f5f5f5', inactive: 'linear-gradient(rgba(207,16,26,0.25), rgba(207,16,26,0.25)) center/33% 100% no-repeat, linear-gradient(rgba(207,16,26,0.25), rgba(207,16,26,0.25)) center/100% 33% no-repeat, #f9f9f9', border: '#CF101A' },
  la_liga: { active: 'linear-gradient(135deg, #AA151B 25%, #F1BF00 25%, #F1BF00 75%, #AA151B 75%)',    inactive: 'linear-gradient(135deg, rgba(170,21,27,0.1) 25%, rgba(241,191,0,0.1) 25%, rgba(241,191,0,0.1) 75%, rgba(170,21,27,0.1) 75%)',    border: '#AA151B' },
  serie_a: { active: 'linear-gradient(135deg, #009246 33%, #f5f5f5 33%, #f5f5f5 66%, #CE2B37 66%)',    inactive: 'linear-gradient(135deg, rgba(0,146,70,0.1) 33%, rgba(245,245,245,0.3) 33%, rgba(245,245,245,0.3) 66%, rgba(206,43,55,0.1) 66%)', border: '#009246' },
  ligue_1: { active: 'linear-gradient(135deg, #002395 33%, #f5f5f5 33%, #f5f5f5 66%, #ED2939 66%)',    inactive: 'linear-gradient(135deg, rgba(0,35,149,0.1) 33%, rgba(245,245,245,0.3) 33%, rgba(245,245,245,0.3) 66%, rgba(237,41,57,0.1) 66%)', border: '#002395' },
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Team {
  id: number
  name: string
  short_name: string
  league_shortcut: string
}

interface TeamMatchday {
  matchday: number
  result: 'x' | '1' | '2' | null
  stake: number
  isPlayed: boolean
}

interface TeamStats {
  totalStake: number
  totalPayout: number
  profit: number
  gamesWithoutDraw: number
  totalDraws: number
}

interface TeamRow {
  team: Team
  matchdays: TeamMatchday[]
  stats: TeamStats
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function TeamsPage() {
  const [activeLeague, setActiveLeague] = useState<LeagueKey>('bl1')
  const [teamRows, setTeamRows] = useState<TeamRow[]>([])
  const [matchdayCount, setMatchdayCount] = useState<number>(34)
  const [lastPlayedMatchday, setLastPlayedMatchday] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('az')
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const targetColumnRef = useRef<HTMLTableCellElement>(null)

  const leagueConfig = LEAGUES.find(l => l.key === activeLeague)!

  // ─── Daten laden wenn Liga wechselt ──────────────────────────────────────────
  useEffect(() => {
    setTeamRows([])
    setLoading(true)
    setExpandedTeamId(null)

    async function fetchTeamsData() {
      try {
        const { data: teams } = await supabase
          .from('teams')
          .select('*')
          .eq('league_shortcut', activeLeague)
          .order('short_name', { ascending: true })

        if (!teams) return

        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('league_shortcut', activeLeague)
          .eq('season', '2025')

        const { data: stakes } = await supabase
          .from('team_stakes')
          .select('*')
          .eq('season', '2025')
          .in('team_id', teams.map(t => t.id))

        const matchIds = matches?.map(m => m.id) || []

        const { data: bets } = matchIds.length > 0
          ? await supabase
              .from('bets')
              .select('*')
              .in('match_id', matchIds)
              .eq('is_evaluated', true)
          : { data: [] }

        const maxMatchday = matches?.reduce((max, m) => Math.max(max, m.matchday), 0) || leagueConfig.totalMatchdays
        setMatchdayCount(maxMatchday)

        const lastPlayed = matches
          ?.filter(m => m.is_finished)
          .reduce((max, m) => Math.max(max, m.matchday), 0) || 0
        setLastPlayedMatchday(lastPlayed)

        const stakesMap = new Map<string, number>()
        stakes?.forEach(s => stakesMap.set(`${s.team_id}-${s.matchday}`, s.stake))

        const betsMap = new Map(bets?.map(b => [b.match_id, b]) || [])

        const processTeam = (team: Team): TeamRow => {
          const matchdays: TeamMatchday[] = []
          let totalStake = 0
          let totalPayout = 0
          let totalDraws = 0

          let gamesWithoutDraw = 0
          for (let md = maxMatchday; md >= 1; md--) {
            const match = matches?.find(m =>
              m.matchday === md &&
              m.is_finished === true &&
              (m.home_team_id === team.id || m.away_team_id === team.id)
            )
            if (!match) continue
            if (match.result === 'x') break
            else gamesWithoutDraw++
          }

          for (let md = 1; md <= maxMatchday; md++) {
            const match = matches?.find(m =>
              m.matchday === md &&
              (m.home_team_id === team.id || m.away_team_id === team.id)
            )

            const stake = stakesMap.get(`${team.id}-${md}`) || 0.5
            totalStake += stake

            if (match && match.is_finished) {
              let result: 'x' | '1' | '2' | null = null

              if (match.result === 'x') {
                result = 'x'
                totalDraws++

                const bet = betsMap.get(match.id)
                if (bet) {
                  const payout = match.home_team_id === team.id
                    ? (bet.payout_home || 0)
                    : (bet.payout_away || 0)
                  totalPayout += payout
                }
              } else if (
                (match.result === '1' && match.home_team_id === team.id) ||
                (match.result === '2' && match.away_team_id === team.id)
              ) {
                result = '1'
              } else {
                result = '2'
              }

              matchdays.push({ matchday: md, result, stake, isPlayed: true })
            } else {
              matchdays.push({ matchday: md, result: null, stake, isPlayed: false })
            }
          }

          return {
            team,
            matchdays,
            stats: { totalStake, totalPayout, profit: totalPayout - totalStake, gamesWithoutDraw, totalDraws }
          }
        }

        setTeamRows(teams.map(processTeam))
      } catch (error) {
        console.error('Fehler beim Laden:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeamsData()
  }, [activeLeague])

  // ─── Scroll zum aktuellen Spieltag ───────────────────────────────────────────
  useEffect(() => {
    if (!loading && lastPlayedMatchday > 0 && targetColumnRef.current && containerRef.current) {
      setTimeout(() => {
        const targetElement = targetColumnRef.current
        const container = containerRef.current
        if (!targetElement || !container) return
        const scrollPosition = targetElement.offsetLeft - (container.clientWidth / 2) + (targetElement.offsetWidth / 2)
        container.scrollTo({ left: scrollPosition, behavior: 'smooth' })
      }, 500)
    }
  }, [loading, lastPlayedMatchday])

  // ─── Scroll → expandedTeam schließen ─────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    const container = containerRef.current
    if (!container) return
    const handleScroll = () => setExpandedTeamId(null)
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [loading])

  // ─── Klick außerhalb → expandedTeam schließen ────────────────────────────────
  useEffect(() => {
    if (expandedTeamId === null) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-team-cell]')) {
        setExpandedTeamId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expandedTeamId])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // ─── Sortierung ───────────────────────────────────────────────────────────────
  const sortedRows = [...teamRows].sort((a, b) => {
    if (sortMode === 'az')      return a.team.short_name.localeCompare(b.team.short_name)
    if (sortMode === 'az-desc') return b.team.short_name.localeCompare(a.team.short_name)
    if (sortMode === 'draws')   return b.stats.totalDraws - a.stats.totalDraws
    if (sortMode === 'without') return b.stats.gamesWithoutDraw - a.stats.gamesWithoutDraw
    return 0
  })

  const handleSortAZ = () => setSortMode(prev => prev === 'az' ? 'az-desc' : 'az')

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-4 sm:py-6 lg:px-8">

        {/* Liga-Tabs */}
        <div className="grid grid-cols-6 gap-1 sm:flex sm:gap-2 mb-4">
          {LEAGUES.map(league => {
            const isActive = activeLeague === league.key
            const colors = COUNTRY_COLORS[league.key]
            return (
              <button
                key={league.key}
                onClick={() => setActiveLeague(league.key)}
                style={{
                  background: isActive ? colors.active : colors.inactive,
                  borderColor: isActive ? colors.border : '#d1d5db',
                  boxShadow: isActive ? `0 0 0 1px ${colors.border}` : undefined,
                }}
                className="px-1 sm:px-4 py-2 rounded-lg font-semibold text-[10px] sm:text-sm transition whitespace-nowrap border text-slate-800 hover:opacity-90"
              >
                {league.label}
              </button>
            )
          })}
        </div>

        {/* Liga-Name + Sortier-Tabs */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
          <h2 className="text-base sm:text-xl font-bold text-slate-800">{leagueConfig.name}</h2>

          <div className="flex gap-1">
            <button
              onClick={handleSortAZ}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold border transition ${
                sortMode === 'az' || sortMode === 'az-desc'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {sortMode === 'az-desc' ? 'Z-A' : 'A-Z'}
            </button>
            <button
              onClick={() => setSortMode('draws')}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold border transition ${
                sortMode === 'draws'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Anz. X
            </button>
            <button
              onClick={() => setSortMode('without')}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold border transition ${
                sortMode === 'without'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Ohne X
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Teams...</p>
          </div>
        ) : sortedRows.length > 0 ? (
          <div ref={containerRef} className="overflow-x-auto shadow-sm rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-20 px-2 sm:px-3 py-2 text-left text-xs font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px] sm:min-w-[110px]">
                    Team
                  </th>
                  {Array.from({ length: matchdayCount }, (_, i) => i + 1).map(md => (
                    <th
                      key={md}
                      ref={md === lastPlayedMatchday ? targetColumnRef : null}
                      className={`px-1 sm:px-2 py-2 text-center text-xs font-semibold min-w-[52px] sm:min-w-[64px] ${
                        md === lastPlayedMatchday ? 'bg-blue-100 text-blue-800' : 'text-slate-700'
                      }`}
                    >
                      {md}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedRows.map(({ team, matchdays, stats }) => {
                  const isExpanded = expandedTeamId === team.id
                  return (
                    <tr key={team.id} className="hover:bg-slate-50 transition">
                      <td data-team-cell className="sticky left-0 z-10 px-2 sm:px-3 py-1.5 bg-white border-r border-slate-200 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <button
                          onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                          className="text-left w-full"
                        >
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 hover:text-blue-600 transition">
                            {team.short_name}
                          </span>
                        </button>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[9px] sm:text-[10px] text-slate-500">Anz.: {stats.totalDraws}</span>
                          <span className="text-[9px] sm:text-[10px] text-slate-500">ohne: {stats.gamesWithoutDraw}</span>
                        </div>
                        {isExpanded && (
                          <div className="mt-1 pt-1 border-t border-slate-100">
                            <div className="text-[9px] sm:text-[10px] text-slate-600">
                              Einsatz: <span className="font-medium">{formatCurrency(stats.totalStake)}</span>
                            </div>
                            <div className={`text-[9px] sm:text-[10px] ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Gewinn: <span className="font-medium">{formatCurrency(stats.profit)}</span>
                            </div>
                          </div>
                        )}
                      </td>
                      {matchdays.map((md, idx) => (
                        <td
                          key={idx}
                          className={`px-1 sm:px-2 py-1.5 text-center ${md.matchday === lastPlayedMatchday ? 'bg-blue-50' : ''}`}
                        >
                          {md.isPlayed ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${md.result === 'x' ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className="text-[8px] sm:text-[10px] text-slate-500">{formatCurrency(md.stake)}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-slate-200" />
                              <span className="text-[8px] sm:text-[10px] text-slate-400">{formatCurrency(md.stake)}</span>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">Keine Teams gefunden</p>
          </div>
        )}
      </div>
    </div>
  )
}