// app/teams/page.tsx
'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

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

// ✅ NEU: Memoized TeamRow Component
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
      <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
        {team.short_name}
      </td>
      <td className="px-4 py-3 text-sm text-center font-semibold text-green-700">
        {drawCount}
      </td>
      <td className="px-4 py-3 text-sm text-center text-slate-600">
        {drawPercentage.toFixed(1)}%
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => {
              const value = e.target.value
              // Erlaube leeren String oder nur Zahlen
              if (value === '' || /^[0-9]+$/.test(value)) {
                // Prüfe ob Wert im gültigen Bereich
                const num = parseInt(value)
                if (value === '' || (num >= 0 && num <= 34)) {
                  onInputChange(team.id, value)
                }
              }
            }}
            className="w-16 px-2 py-1 text-sm text-slate-900 font-medium border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center"
          />
          <span className="text-xs text-slate-500">Spiele</span>
        </div>
      </td>
    </tr>
  )
})

TeamRow.displayName = 'TeamRow'

export default function TeamsPage() {
  const [bl1Teams, setBl1Teams] = useState<TeamStats[]>([])
  const [bl2Teams, setBl2Teams] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Toggler States
  const [showBl1, setShowBl1] = useState(true)
  const [showBl2, setShowBl2] = useState(true)

  // Input Werte - Schlüssel ist team.id
  const [inputValues, setInputValues] = useState<Record<number, string>>({})
  
  // Original Werte zum Vergleich
  const [originalValues, setOriginalValues] = useState<Record<number, number>>({})

  useEffect(() => {
    async function fetchTeamsData() {
      setLoading(true)
      
      try {
        // 1. Hole alle Teams
        const { data: teams } = await supabase
          .from('teams')
          .select('*')
          .order('name', { ascending: true })

        if (!teams) return

        // 2. Hole alle Matches mit Ergebnissen
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('season', '2025')
          .eq('is_finished', true)

        // 3. Berechne Statistiken für jedes Team
        const calculateTeamStats = (team: Team): TeamStats => {
          const teamMatches = matches?.filter(m => 
            m.home_team_id === team.id || m.away_team_id === team.id
          ) || []

          const drawCount = teamMatches.filter(m => m.result === 'x').length
          const totalMatches = teamMatches.length
          const drawPercentage = totalMatches > 0 ? (drawCount / totalMatches) * 100 : 0

          return {
            team,
            totalMatches,
            drawCount,
            drawPercentage
          }
        }

        // 4. Verarbeite Teams nach Liga
        const bl1 = teams
          .filter(t => t.league_shortcut === 'bl1')
          .map(calculateTeamStats)
        
        const bl2 = teams
          .filter(t => t.league_shortcut === 'bl2')
          .map(calculateTeamStats)

        setBl1Teams(bl1)
        setBl2Teams(bl2)

        // 5. Initialisiere Input- und Original-Werte
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
  }, [])

  // Prüfe ob Änderungen vorhanden sind
  const hasChanges = Object.keys(inputValues).some(teamIdStr => {
    const teamId = parseInt(teamIdStr)
    const currentValue = parseInt(inputValues[teamId] || '0')
    const originalValue = originalValues[teamId]
    return !isNaN(currentValue) && currentValue !== originalValue
  })

  const handleInputChange = useCallback((teamId: number, value: string) => {
    // Aktualisiere nur den Input-Wert
    setInputValues(prev => ({
      ...prev,
      [teamId]: value
    }))
  }, [])

  const handleSaveAll = async () => {
    setSaving(true)

    try {
      // Sammle alle Änderungen
      const updates: Array<{ id: number; value: number }> = []
      
      Object.keys(inputValues).forEach(teamIdStr => {
        const teamId = parseInt(teamIdStr)
        const currentValue = parseInt(inputValues[teamId] || '0')
        const originalValue = originalValues[teamId]
        
        if (!isNaN(currentValue) && currentValue >= 0 && currentValue <= 34 && currentValue !== originalValue) {
          updates.push({ id: teamId, value: currentValue })
        }
      })

      if (updates.length === 0) {
        alert('Keine gültigen Änderungen zum Speichern')
        return
      }

      // Speichere alle Änderungen
      for (const update of updates) {
        const { error } = await supabase
          .from('teams')
          .update({ games_to_wait_after_draw: update.value })
          .eq('id', update.id)

        if (error) throw error
      }

      // Aktualisiere Original-Werte
      const newOriginals = { ...originalValues }
      updates.forEach(u => {
        newOriginals[u.id] = u.value
      })
      setOriginalValues(newOriginals)

      // Aktualisiere Team States
      const updateTeamValue = (team: Team) => ({
        ...team,
        games_to_wait_after_draw: parseInt(inputValues[team.id] || '0')
      })

      setBl1Teams(prev => prev.map(ts => ({
        ...ts,
        team: updateTeamValue(ts.team)
      })))

      setBl2Teams(prev => prev.map(ts => ({
        ...ts,
        team: updateTeamValue(ts.team)
      })))

      alert(`${updates.length} Team(s) erfolgreich gespeichert!`)
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      {/* Fixed Save Button */}
      <div className="fixed top-20 right-4 z-50">
        <button
          onClick={handleSaveAll}
          disabled={saving || !hasChanges}
          className={`px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-xl flex items-center gap-2 ${
            hasChanges 
              ? 'bg-green-600 hover:bg-green-700 text-white scale-100' 
              : 'bg-slate-300 text-slate-500 cursor-not-allowed scale-95'
          }`}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Speichert...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
              </svg>
              Alle Änderungen speichern
            </>
          )}
        </button>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Teams Übersicht</h1>
          
          {/* Ligen-Toggle */}
          <div className="flex gap-2">
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
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Teams...</p>
          </div>
        ) : (
          <>
            {/* 1. Bundesliga */}
            {showBl1 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-slate-800">1. Bundesliga</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    {bl1Teams.length} Teams
                  </span>
                </div>
                
                {bl1Teams.length > 0 ? (
                  <div className="overflow-x-auto shadow-sm rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 bg-white">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Team</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">Anzahl X</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">% X</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Warten nach X</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {bl1Teams.map(ts => (
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
            )}

            {/* 2. Bundesliga */}
            {showBl2 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-slate-800">2. Bundesliga</h2>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                    {bl2Teams.length} Teams
                  </span>
                </div>
                
                {bl2Teams.length > 0 ? (
                  <div className="overflow-x-auto shadow-sm rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 bg-white">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Team</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">Anzahl X</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">% X</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Warten nach X</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {bl2Teams.map(ts => (
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
            )}

            {/* Keine Liga ausgewählt */}
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