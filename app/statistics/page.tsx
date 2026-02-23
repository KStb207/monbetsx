'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

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
}

interface TeamRow {
  team: Team
  matchdays: TeamMatchday[]
  stats: TeamStats
}

export default function TeamsPage() {
  const [bl1Teams, setBl1Teams] = useState<TeamRow[]>([])
  const [bl2Teams, setBl2Teams] = useState<TeamRow[]>([])
  const [matchdayCount, setMatchdayCount] = useState<number>(34)
  const [lastPlayedMatchday, setLastPlayedMatchday] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  
  const [showBl1, setShowBl1] = useState(true)
  const [showBl2, setShowBl2] = useState(true)

  // ✅ Refs für horizontales Scrollen
  const bl1ContainerRef = useRef<HTMLDivElement>(null)
  const bl2ContainerRef = useRef<HTMLDivElement>(null)
  const targetColumnRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    async function fetchTeamsData() {
      setLoading(true)
      
      try {
        const { data: teams } = await supabase
          .from('teams')
          .select('*')
          .order('short_name', { ascending: true })

        if (!teams) return

        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('season', '2025')

        const { data: stakes } = await supabase
          .from('team_stakes')
          .select('*')
          .eq('season', '2025')

        const { data: bets } = await supabase
          .from('bets')
          .select('*')
          .eq('season', '2025')
          .eq('is_evaluated', true)

        const maxMatchday = matches?.reduce((max, m) => Math.max(max, m.matchday), 0) || 34
        setMatchdayCount(maxMatchday)

        const lastPlayed = matches
          ?.filter(m => m.is_finished)
          .reduce((max, m) => Math.max(max, m.matchday), 0) || 0
        setLastPlayedMatchday(lastPlayed)

        const stakesMap = new Map<string, number>()
        stakes?.forEach(s => {
          stakesMap.set(`${s.team_id}-${s.matchday}`, s.stake)
        })

        const betsMap = new Map(bets?.map(b => [b.match_id, b]) || [])

        const processTeam = (team: Team): TeamRow => {
          const matchdays: TeamMatchday[] = []
          let totalStake = 0
          let totalPayout = 0

          let gamesWithoutDraw = 0
          for (let md = maxMatchday; md >= 1; md--) {
            const match = matches?.find(m => 
              m.matchday === md && 
              m.is_finished === true &&
              (m.home_team_id === team.id || m.away_team_id === team.id)
            )
            
            if (!match) continue
            
            if (match.result === 'x') {
              break
            } else {
              gamesWithoutDraw++
            }
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

              matchdays.push({
                matchday: md,
                result: result,
                stake: stake,
                isPlayed: true
              })
            } else {
              matchdays.push({
                matchday: md,
                result: null,
                stake: stake,
                isPlayed: false
              })
            }
          }

          return { 
            team, 
            matchdays,
            stats: {
              totalStake,
              totalPayout,
              profit: totalPayout - totalStake,
              gamesWithoutDraw
            }
          }
        }

        const bl1 = teams
          .filter(t => t.league_shortcut === 'bl1')
          .map(processTeam)
        
        const bl2 = teams
          .filter(t => t.league_shortcut === 'bl2')
          .map(processTeam)

        setBl1Teams(bl1)
        setBl2Teams(bl2)
      } catch (error) {
        console.error('Fehler beim Laden:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeamsData()
  }, [])

  // ✅ Horizontales Scrollen zur letzten Spieltag-Spalte
  useEffect(() => {
    if (!loading && lastPlayedMatchday > 0 && targetColumnRef.current) {
      setTimeout(() => {
        const targetElement = targetColumnRef.current
        if (!targetElement) return

        // Scrolle beide Container
        const containers = [bl1ContainerRef.current, bl2ContainerRef.current].filter(Boolean)
        
        containers.forEach(container => {
          if (container) {
            const targetLeft = targetElement.offsetLeft
            const containerWidth = container.clientWidth
            const targetWidth = targetElement.offsetWidth
            
            // Scrolle so dass die Spalte in der Mitte ist
            const scrollPosition = targetLeft - (containerWidth / 2) + (targetWidth / 2)
            
            container.scrollTo({
              left: scrollPosition,
              behavior: 'smooth'
            })
          }
        })
      }, 500)
    }
  }, [loading, lastPlayedMatchday])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const TeamTable = ({ teams, league, containerRef }: { 
    teams: TeamRow[], 
    league: string,
    containerRef: React.RefObject<HTMLDivElement>
  }) => (
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
                ref={md === lastPlayedMatchday ? targetColumnRef : null} // ✅ Ref nur für Positionsberechnung
                className={`px-3 py-3 text-center text-xs font-semibold min-w-[80px] ${
                  md === lastPlayedMatchday 
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-700'
                }`}
              >
                {md}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {teams.map(({ team, matchdays, stats }) => (
            <tr key={team.id} className="hover:bg-slate-50 transition">
              <td className="sticky left-0 z-10 px-4 py-3 bg-white border-r border-slate-200 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">
                    {team.short_name}
                  </span>
                  <span className="text-xs text-blue-600 font-medium mt-0.5">
                    ohne x: {stats.gamesWithoutDraw} {stats.gamesWithoutDraw === 1 ? 'Spiel' : 'Spiele'}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-xs text-slate-500">
                      Einsatz: <span className="font-medium text-slate-700">{formatCurrency(stats.totalStake)}</span>
                    </span>
                    <span className={`text-xs ${
                      stats.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Gewinn: <span className="font-medium">{formatCurrency(stats.profit)}</span>
                    </span>
                  </div>
                </div>
              </td>
              {matchdays.map((md, idx) => {
                const isLastPlayed = md.matchday === lastPlayedMatchday
                
                return (
                  <td 
                    key={idx}
                    className={`px-3 py-3 text-center ${
                      isLastPlayed ? 'bg-blue-50' : ''
                    }`}
                  >
                    {md.isPlayed ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${
                          md.result === 'x' 
                            ? 'bg-green-500' 
                            : 'bg-red-500'
                        }`} />
                        <span className="text-xs text-slate-600">
                          {formatCurrency(md.stake)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-slate-200" />
                        <span className="text-xs text-slate-400">
                          {formatCurrency(md.stake)}
                        </span>
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="max-w-[1600px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mr-4">Statistik</h1>
          
          <button
            onClick={() => setShowBl1(!showBl1)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              showBl1
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            1. BL
          </button>

          <button
            onClick={() => setShowBl2(!showBl2)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              showBl2
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            2. BL
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Teams...</p>
          </div>
        ) : (
          <>
            {showBl1 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-slate-800">1. Bundesliga</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    {bl1Teams.length} Teams
                  </span>
                </div>
                
                {bl1Teams.length > 0 ? (
                  <TeamTable teams={bl1Teams} league="bl1" containerRef={bl1ContainerRef} />
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">Keine Teams gefunden</p>
                  </div>
                )}
              </div>
            )}

            {showBl2 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-slate-800">2. Bundesliga</h2>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                    {bl2Teams.length} Teams
                  </span>
                </div>
                
                {bl2Teams.length > 0 ? (
                  <TeamTable teams={bl2Teams} league="bl2" containerRef={bl2ContainerRef} />
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">Keine Teams gefunden</p>
                  </div>
                )}
              </div>
            )}

            {!showBl1 && !showBl2 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                <p className="text-slate-500">Bitte mindestens eine Liga auswählen</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}