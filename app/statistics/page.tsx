'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'bl1',     label: '1. BL',   name: '1. Bundesliga',  color: 'blue',   totalMatchdays: 34 },
  { key: 'bl2',     label: '2. BL',   name: '2. Bundesliga',  color: 'slate',  totalMatchdays: 34 },
  { key: 'epl',     label: 'EPL',     name: 'Premier League', color: 'purple', totalMatchdays: 38 },
  { key: 'la_liga', label: 'La Liga', name: 'La Liga',        color: 'red',    totalMatchdays: 38 },
  { key: 'serie_a', label: 'Serie A', name: 'Serie A',        color: 'green',  totalMatchdays: 38 },
  { key: 'ligue_1', label: 'Ligue 1', name: 'Ligue 1',        color: 'indigo', totalMatchdays: 34 },
] as const

type LeagueKey = typeof LEAGUES[number]['key']

const TAB_ACTIVE: Record<string, string> = {
  blue:   'bg-blue-600 text-white shadow-sm',
  slate:  'bg-slate-700 text-white shadow-sm',
  purple: 'bg-purple-600 text-white shadow-sm',
  red:    'bg-red-600 text-white shadow-sm',
  green:  'bg-green-600 text-white shadow-sm',
  indigo: 'bg-indigo-600 text-white shadow-sm',
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

  const containerRef = useRef<HTMLDivElement>(null)
  const targetColumnRef = useRef<HTMLTableCellElement>(null)

  const leagueConfig = LEAGUES.find(l => l.key === activeLeague)!

  // ─── Daten laden wenn Liga wechselt ──────────────────────────────────────────
  useEffect(() => {
    setTeamRows([])
    setLoading(true)

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

          // Spiele ohne X von hinten zählen
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <div className="max-w-[1600px] mx-auto px-4 py-6 sm:px-6 lg:px-8">

        {/* Header + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mr-2">Statistik</h1>

          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
            {LEAGUES.map(league => (
              <button
                key={league.key}
                onClick={() => setActiveLeague(league.key)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-[11px] sm:text-sm transition whitespace-nowrap flex-shrink-0 ${
                  activeLeague === league.key
                    ? TAB_ACTIVE[league.color]
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {league.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liga-Name + Team-Count */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-slate-800">{leagueConfig.name}</h2>
          {!loading && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              activeLeague === 'bl1'     ? 'bg-blue-100 text-blue-700'     :
              activeLeague === 'bl2'     ? 'bg-slate-100 text-slate-700'   :
              activeLeague === 'epl'     ? 'bg-purple-100 text-purple-700' :
              activeLeague === 'la_liga' ? 'bg-red-100 text-red-700'       :
              activeLeague === 'serie_a' ? 'bg-green-100 text-green-700'   :
              'bg-indigo-100 text-indigo-700'
            }`}>
              {teamRows.length} Teams
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Teams...</p>
          </div>
        ) : teamRows.length > 0 ? (
          <div ref={containerRef} className="overflow-x-auto shadow-sm rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-20 px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Team
                  </th>
                  {Array.from({ length: matchdayCount }, (_, i) => i + 1).map(md => (
                    <th
                      key={md}
                      ref={md === lastPlayedMatchday ? targetColumnRef : null}
                      className={`px-3 py-3 text-center text-xs font-semibold min-w-[80px] ${
                        md === lastPlayedMatchday ? 'bg-blue-100 text-blue-800' : 'text-slate-700'
                      }`}
                    >
                      {md}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {teamRows.map(({ team, matchdays, stats }) => (
                  <tr key={team.id} className="hover:bg-slate-50 transition">
                    <td className="sticky left-0 z-10 px-4 py-3 bg-white border-r border-slate-200 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">{team.short_name}</span>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-xs text-slate-600 font-medium">
                            ohne x: {stats.gamesWithoutDraw} {stats.gamesWithoutDraw === 1 ? 'Spiel' : 'Spiele'}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">
                            Anzahl x: {stats.totalDraws}
                          </span>
                          <span className="text-xs text-slate-600">
                            Einsatz: <span className="font-medium text-slate-700">{formatCurrency(stats.totalStake)}</span>
                          </span>
                          <span className={`text-xs ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Gewinn: <span className="font-medium">{formatCurrency(stats.profit)}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    {matchdays.map((md, idx) => (
                      <td
                        key={idx}
                        className={`px-3 py-3 text-center ${md.matchday === lastPlayedMatchday ? 'bg-blue-50' : ''}`}
                      >
                        {md.isPlayed ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-3 h-3 rounded-full ${md.result === 'x' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-xs text-slate-600">{formatCurrency(md.stake)}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-slate-200" />
                            <span className="text-xs text-slate-400">{formatCurrency(md.stake)}</span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
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