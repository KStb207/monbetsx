'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

interface Match {
  id: number
  matchday: number
  home_team_id: number
  away_team_id: number
  home_goals: number | null
  away_goals: number | null
  match_date: string
  is_finished: boolean
  result: string | null
  league_shortcut: string
  home_team: {
    name: string
    short_name: string
  }
  away_team: {
    name: string
    short_name: string
  }
}

export default function MatchdayPage() {
  const [selectedMatchday, setSelectedMatchday] = useState<number>(1)
  const [bl1Matches, setBl1Matches] = useState<Match[]>([])
  const [bl2Matches, setBl2Matches] = useState<Match[]>([])
  const [availableMatchdays, setAvailableMatchdays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  // Lade verfügbare Spieltage
  useEffect(() => {
    async function fetchMatchdays() {
      const { data, error } = await supabase
        .from('matches')
        .select('matchday')
        .order('matchday', { ascending: true })
      
      if (data) {
        const uniqueMatchdays = [...new Set(data.map(m => m.matchday))].sort((a, b) => a - b)
        setAvailableMatchdays(uniqueMatchdays)
        
        // Setze aktuellen Spieltag (höchster mit beendeten Spielen)
        const { data: finishedMatches } = await supabase
          .from('matches')
          .select('matchday')
          .eq('is_finished', true)
          .order('matchday', { ascending: false })
          .limit(1)
        
        if (finishedMatches && finishedMatches.length > 0) {
          setSelectedMatchday(finishedMatches[0].matchday)
        }
      }
    }
    fetchMatchdays()
  }, [])

  // Lade Spiele für ausgewählten Spieltag
  useEffect(() => {
    async function fetchMatches() {
      setLoading(true)
      
      // 1. Bundesliga
      const { data: bl1Data } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, short_name),
          away_team:teams!matches_away_team_id_fkey(name, short_name)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', 'bl1')
        .order('match_date', { ascending: true })
      
      // 2. Bundesliga
      const { data: bl2Data } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, short_name),
          away_team:teams!matches_away_team_id_fkey(name, short_name)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', 'bl2')
        .order('match_date', { ascending: true })
      
      if (bl1Data) setBl1Matches(bl1Data as any)
      if (bl2Data) setBl2Matches(bl2Data as any)
      
      setLoading(false)
    }
    
    if (selectedMatchday) {
      fetchMatches()
    }
  }, [selectedMatchday])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const MatchCard = ({ match }: { match: Match }) => (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
      <div className="flex items-center justify-between">
        {/* Heimteam */}
        <div className="flex-1 text-right">
          <p className="font-semibold text-slate-800">{match.home_team.short_name}</p>
        </div>
        
        {/* Ergebnis */}
        <div className="mx-4 min-w-[80px] text-center">
          {match.is_finished ? (
            <div className="flex items-center justify-center gap-2">
              <span className={`text-2xl font-bold ${
                match.result === 'x' ? 'text-green-600' : 'text-slate-600'
              }`}>
                {match.home_goals}
              </span>
              <span className="text-slate-400">:</span>
              <span className={`text-2xl font-bold ${
                match.result === 'x' ? 'text-green-600' : 'text-slate-600'
              }`}>
                {match.away_goals}
              </span>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              {formatDate(match.match_date)}
            </div>
          )}
        </div>
        
        {/* Auswärtsteam */}
        <div className="flex-1 text-left">
          <p className="font-semibold text-slate-800">{match.away_team.short_name}</p>
        </div>
      </div>
      
      {/* Ergebnis-Badge */}
      {match.is_finished && (
        <div className="mt-2 text-center">
          {match.result === 'x' ? (
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              Unentschieden
            </span>
          ) : (
            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
              {match.result === '1' ? 'Heimsieg' : 'Auswärtssieg'}
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Spieltag-Auswahl */}
        <div className="mb-8">
          <label htmlFor="matchday" className="block text-sm font-medium text-slate-700 mb-2">
            Spieltag auswählen
          </label>
          <select
            id="matchday"
            value={selectedMatchday}
            onChange={(e) => setSelectedMatchday(Number(e.target.value))}
            className="block w-full max-w-xs px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 font-semibold"
          >
            {availableMatchdays.map(day => (
              <option key={day} value={day}>
                {day}. Spieltag
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade Spiele...</p>
          </div>
        ) : (
          <>
            {/* 1. Bundesliga */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-800">1. Bundesliga</h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {bl1Matches.length} Spiele
                </span>
              </div>
              
              {bl1Matches.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bl1Matches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8 bg-white rounded-lg">
                  Keine Spiele verfügbar
                </p>
              )}
            </div>

            {/* 2. Bundesliga */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-800">2. Bundesliga</h2>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                  {bl2Matches.length} Spiele
                </span>
              </div>
              
              {bl2Matches.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bl2Matches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8 bg-white rounded-lg">
                  Keine Spiele verfügbar
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}