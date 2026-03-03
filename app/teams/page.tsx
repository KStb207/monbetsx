// app/teams/page.tsx
'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'bl1',     label: '1. BL',   name: '1. Bundesliga',  color: 'blue'   },
  { key: 'bl2',     label: '2. BL',   name: '2. Bundesliga',  color: 'slate'  },
  { key: 'epl',     label: 'PL',      name: 'Premier League', color: 'purple' },
  { key: 'la_liga', label: 'La Liga', name: 'La Liga',        color: 'red'    },
  { key: 'serie_a', label: 'Serie A', name: 'Serie A',        color: 'green'  },
  { key: 'ligue_1', label: 'Ligue 1', name: 'Ligue 1',        color: 'indigo' },
] as const

type LeagueKey = typeof LEAGUES[number]['key']

// ─── Länderfarben für Tabs ─────────────────────────────────────────────────────
const COUNTRY_COLORS: Record<string, { active: string; inactive: string; border: string }> = {
  bl1:     { active: 'linear-gradient(135deg, #1a1a1a 33%, #CC0000 33%, #CC0000 66%, #FFCE00 66%)',     inactive: 'linear-gradient(135deg, rgba(26,26,26,0.08) 33%, rgba(204,0,0,0.08) 33%, rgba(204,0,0,0.08) 66%, rgba(255,206,0,0.08) 66%)',     border: '#CC0000' },
  bl2:     { active: 'linear-gradient(135deg, #1a1a1a 33%, #CC0000 33%, #CC0000 66%, #FFCE00 66%)',     inactive: 'linear-gradient(135deg, rgba(26,26,26,0.08) 33%, rgba(204,0,0,0.08) 33%, rgba(204,0,0,0.08) 66%, rgba(255,206,0,0.08) 66%)',     border: '#CC0000' },
  epl:     { active: 'linear-gradient(#CF101A, #CF101A) center/33% 100% no-repeat, linear-gradient(#CF101A, #CF101A) center/100% 33% no-repeat, #f5f5f5',  inactive: 'linear-gradient(rgba(207,16,26,0.25), rgba(207,16,26,0.25)) center/33% 100% no-repeat, linear-gradient(rgba(207,16,26,0.25), rgba(207,16,26,0.25)) center/100% 33% no-repeat, #f9f9f9', border: '#CF101A' },
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
  games_to_wait_after_draw: number
}

interface TeamStats {
  team: Team
  totalMatches: number
  drawCount: number
  drawPercentage: number
}

// ─── Memoized TeamRow ─────────────────────────────────────────────────────────
const TeamRow = memo(({
  teamStats,
  inputValue,
  onInputChange
}: {
  teamStats: TeamStats
  inputValue: string
  onInputChange: (teamId: number, value: string) => void
}) => {
  const { team, drawCount, drawPercentage } = teamStats

  return (
    <tr className="hover:bg-slate-50 transition">
      <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-800 whitespace-nowrap">
        {team.short_name}
      </td>
      <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-xs sm:text-sm text-center font-semibold text-green-700">
        {drawCount}
      </td>
      <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-xs sm:text-sm text-center text-slate-600">
        {drawPercentage.toFixed(1)}%
      </td>
      <td className="px-2 sm:px-4 py-1.5 sm:py-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => {
              const value = e.target.value
              if (value === '' || /^[0-9]+$/.test(value)) {
                const num = parseInt(value)
                if (value === '' || (num >= 0 && num <= 34)) {
                  onInputChange(team.id, value)
                }
              }
            }}
            className="w-12 sm:w-16 px-1 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-sm text-slate-900 font-medium border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center"
          />
          <span className="text-[10px] sm:text-xs text-slate-500 hidden sm:inline">Spiele</span>
        </div>
      </td>
    </tr>
  )
})

TeamRow.displayName = 'TeamRow'

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function TeamsPage() {
  const [activeLeague, setActiveLeague] = useState<LeagueKey>('bl1')
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  const [inputValues, setInputValues] = useState<Record<number, string>>({})
  const [originalValues, setOriginalValues] = useState<Record<number, number>>({})

  const leagueConfig = LEAGUES.find(l => l.key === activeLeague)!

  // ─── Daten laden wenn Liga wechselt ──────────────────────────────────────────
  useEffect(() => {
    setTeamStats([])
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
          .eq('is_finished', true)

        const calculateStats = (team: Team): TeamStats => {
          const teamMatches = matches?.filter(m =>
            m.home_team_id === team.id || m.away_team_id === team.id
          ) || []
          const drawCount = teamMatches.filter(m => m.result === 'x').length
          const totalMatches = teamMatches.length
          return { team, totalMatches, drawCount, drawPercentage: totalMatches > 0 ? (drawCount / totalMatches) * 100 : 0 }
        }

        setTeamStats(teams.map(calculateStats))

        const inputs: Record<number, string> = {}
        const originals: Record<number, number> = {}
        teams.forEach(t => {
          inputs[t.id] = t.games_to_wait_after_draw.toString()
          originals[t.id] = t.games_to_wait_after_draw
        })
        setInputValues(inputs)
        setOriginalValues(originals)
      } catch (error) {
        console.error('Fehler beim Laden:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeamsData()
  }, [activeLeague])

  // ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
  const hasChanges = Object.keys(inputValues).some(teamIdStr => {
    const teamId = parseInt(teamIdStr)
    const currentValue = parseInt(inputValues[teamId] || '0')
    return !isNaN(currentValue) && currentValue !== originalValues[teamId]
  })

  const handleInputChange = useCallback((teamId: number, value: string) => {
    setInputValues(prev => ({ ...prev, [teamId]: value }))
  }, [])

  // ─── Speichern ────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const updates: Array<{ id: number; value: number }> = []

      Object.keys(inputValues).forEach(teamIdStr => {
        const teamId = parseInt(teamIdStr)
        const currentValue = parseInt(inputValues[teamId] || '0')
        if (!isNaN(currentValue) && currentValue >= 0 && currentValue <= 34 && currentValue !== originalValues[teamId]) {
          updates.push({ id: teamId, value: currentValue })
        }
      })

      if (updates.length === 0) { alert('Keine gültigen Änderungen zum Speichern'); return }

      for (const update of updates) {
        const { error } = await supabase
          .from('teams')
          .update({ games_to_wait_after_draw: update.value })
          .eq('id', update.id)
        if (error) throw error
      }

      const newOriginals = { ...originalValues }
      updates.forEach(u => { newOriginals[u.id] = u.value })
      setOriginalValues(newOriginals)

      setTeamStats(prev => prev.map(ts => {
        const update = updates.find(u => u.id === ts.team.id)
        if (!update) return ts
        return { ...ts, team: { ...ts.team, games_to_wait_after_draw: update.value } }
      }))

      alert(`${updates.length} Team(s) erfolgreich gespeichert!`)
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  // ─── Stakes berechnen ─────────────────────────────────────────────────────────
  const handleCalculateStakes = async () => {
    setCalculating(true)
    try {
      const { data: lastFinishedMatch } = await supabase
        .from('matches')
        .select('matchday')
        .eq('league_shortcut', activeLeague)
        .eq('season', '2025')
        .eq('is_finished', true)
        .order('matchday', { ascending: false })
        .limit(1)

      if (!lastFinishedMatch || lastFinishedMatch.length === 0) {
        alert('Keine beendeten Spiele gefunden')
        return
      }

      const lastMatchday = lastFinishedMatch[0].matchday

      const { error } = await supabase.rpc('calculate_stakes_after_matchday', {
        p_matchday: lastMatchday,
        p_league_shortcut: activeLeague,
        p_season: '2025'
      })

      if (error) throw error

      alert(`Einsätze für Spieltag ${lastMatchday + 1} (${leagueConfig.name}) erfolgreich berechnet!`)
    } catch (error) {
      console.error('Fehler beim Berechnen:', error)
      alert('Fehler beim Berechnen der Einsätze')
    } finally {
      setCalculating(false)
    }
  }

  // ─── Rückwirkend berechnen ────────────────────────────────────────────────────
  const handleRecalculateStakes = async () => {
    setRecalculating(true)
    try {
      const { data, error } = await supabase.rpc('recalculate_all_stakes_from_last_draw', {
        p_league_shortcut: activeLeague,
        p_season: '2025'
      })

      if (error) throw error

      alert(`${data?.length || 0} Einsätze (${leagueConfig.name}) rückwirkend neu berechnet!`)
    } catch (error) {
      console.error('Fehler beim rückwirkenden Berechnen:', error)
      alert('Fehler beim rückwirkenden Berechnen der Einsätze')
    } finally {
      setRecalculating(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Teams Übersicht</h1>

            {/* Liga-Tabs */}
            <div className="grid grid-cols-6 gap-1 sm:flex sm:gap-2 w-full sm:w-auto">
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
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={handleSaveAll}
              disabled={saving || !hasChanges}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs ${
                hasChanges
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span className="whitespace-nowrap">Speichert...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                  <span className="whitespace-nowrap">Speichern</span>
                </>
              )}
            </button>

            <button
              onClick={handleCalculateStakes}
              disabled={calculating}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs ${
                calculating ? 'bg-blue-400 cursor-wait text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {calculating ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span className="whitespace-nowrap">Berechnet...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                  </svg>
                  <span className="whitespace-nowrap">Berechnen</span>
                </>
              )}
            </button>

            <button
              onClick={handleRecalculateStakes}
              disabled={recalculating}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs ${
                recalculating ? 'bg-purple-400 cursor-wait text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {recalculating ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span className="whitespace-nowrap">Berechnet...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  <span className="whitespace-nowrap">Rückwirkend</span>
                </>
              )}
            </button>
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
              {teamStats.length} Teams
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Teams...</p>
          </div>
        ) : teamStats.length > 0 ? (
          <div className="overflow-x-auto shadow-sm rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700">Team</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700">Anz. X</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700">% X</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700">Warten</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {teamStats.map(ts => (
                  <TeamRow
                    key={ts.team.id}
                    teamStats={ts}
                    inputValue={inputValues[ts.team.id] || ''}
                    onInputChange={handleInputChange}
                  />
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