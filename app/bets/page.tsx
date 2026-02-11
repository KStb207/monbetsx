'use client'

import { useEffect, useState, useRef } from 'react'
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
    id: number
    name: string
    short_name: string
  }
  away_team: {
    id: number
    name: string
    short_name: string
  }
  home_stake: number
  away_stake: number
  total_stake: number
  odds: number | null
}

interface AlternativeStake {
  matchId: number
  alternativeAmount: number
  originalStake: number
  quote: number
}

export default function BetsPage() {
  const [selectedMatchday, setSelectedMatchday] = useState<number>(1)
  const [bl1Matches, setBl1Matches] = useState<Match[]>([])
  const [bl2Matches, setBl2Matches] = useState<Match[]>([])
  const [availableMatchdays, setAvailableMatchdays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null)
  
  // Toggler States
  const [showBl1, setShowBl1] = useState(true)
  const [showBl2, setShowBl2] = useState(true)

  // Alternative Stake States
  const [alternativeStakes, setAlternativeStakes] = useState<Map<number, AlternativeStake>>(new Map())
  const [showModal, setShowModal] = useState(false)
  const [modalMatchId, setModalMatchId] = useState<number | null>(null)

  // Lade verfügbare Spieltage und setze nächsten Spieltag
  useEffect(() => {
    async function fetchMatchdays() {
      const { data } = await supabase
        .from('matches')
        .select('matchday, match_date, is_finished')
        .order('matchday', { ascending: true })
      
      if (data) {
        const uniqueMatchdays = [...new Set(data.map(m => m.matchday))].sort((a, b) => a - b)
        setAvailableMatchdays(uniqueMatchdays)
        
        // Finde das nächste anstehende Spiel (zeitlich am nächsten)
        const now = new Date()
        
        // Filtere nur zukünftige Spiele (inkl. heute)
        const upcomingMatches = data
          .filter(match => new Date(match.match_date) >= now && !match.is_finished)
          .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
        
        if (upcomingMatches.length > 0) {
          // Wähle den Spieltag des zeitlich nächsten Spiels
          setSelectedMatchday(upcomingMatches[0].matchday)
        } else {
          // Fallback: Letzter Spieltag wenn keine zukünftigen Spiele
          setSelectedMatchday(uniqueMatchdays[uniqueMatchdays.length - 1])
        }
      }
    }
    fetchMatchdays()
  }, [])

  // Lade Spiele und Stakes für ausgewählten Spieltag
  useEffect(() => {
    async function fetchMatchesWithStakes() {
      setLoading(true)
      
      // 1. Hole alle Matches für beide Ligen
      const { data: bl1Data } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', 'bl1')
        .order('match_date', { ascending: true })
      
      const { data: bl2Data } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', 'bl2')
        .order('match_date', { ascending: true })
      
      // 2. Hole alle Stakes für diesen Spieltag
      const { data: stakes } = await supabase
        .from('team_stakes')
        .select('team_id, stake')
        .eq('matchday', selectedMatchday)
        .eq('season', '2025')
      
      // 3. Hole alle Bets (für Quoten)
      const allMatchIds = [
        ...(bl1Data?.map(m => m.id) || []),
        ...(bl2Data?.map(m => m.id) || [])
      ]
      
      const { data: bets } = await supabase
        .from('bets')
        .select('match_id, odds')
        .in('match_id', allMatchIds)
      
      // 4. Erstelle Maps für schnellen Zugriff
      const stakesMap = new Map(stakes?.map(s => [s.team_id, s.stake]) || [])
      const betsMap = new Map(bets?.map(b => [b.match_id, b.odds]) || [])
      
      // 5. Füge Stakes und Odds zu Matches hinzu
      const enrichMatches = (matches: any[]): Match[] => {
        return matches.map(match => ({
          ...match,
          home_stake: stakesMap.get(match.home_team_id) || 0.5,
          away_stake: stakesMap.get(match.away_team_id) || 0.5,
          total_stake: (stakesMap.get(match.home_team_id) || 0.5) + (stakesMap.get(match.away_team_id) || 0.5),
          odds: betsMap.get(match.id) || null
        }))
      }
      
      if (bl1Data) setBl1Matches(enrichMatches(bl1Data))
      if (bl2Data) setBl2Matches(enrichMatches(bl2Data))
      
      setLoading(false)
    }
    
    if (selectedMatchday) {
      fetchMatchesWithStakes()
    }
  }, [selectedMatchday])

  const calculateAlternativeStake = (totalStake: number, odds: number): number => {
    return (totalStake * 3) / odds
  }

  const handleSaveOdds = async (matchId: number, odds: number, match: Match) => {
  setSavingMatchId(matchId)
  
  try {
    // Upsert in bets Tabelle - MIT home_stake, away_stake, total_stake
    const { error } = await supabase
      .from('bets')
      .upsert({
        match_id: matchId,
        matchday: selectedMatchday,
        season: '2025',
        odds: odds,
        home_stake: match.home_stake,
        away_stake: match.away_stake,
        total_stake: match.total_stake
      }, {
        onConflict: 'match_id'
      })
    
    if (error) throw error
    
    // Aktualisiere lokalen State
    const updateMatches = (matches: Match[]) =>
      matches.map(m => m.id === matchId ? { ...m, odds } : m)
    
    setBl1Matches(updateMatches)
    setBl2Matches(updateMatches)
    
    // Prüfe ob mindestens ein Team über 250€ ist
    if (match.home_stake > 250 || match.away_stake > 250) {
      const alternative = calculateAlternativeStake(match.total_stake, odds)
      setAlternativeStakes(prev => new Map(prev).set(matchId, {
        matchId,
        alternativeAmount: alternative,
        originalStake: match.total_stake,
        quote: odds
      }))
    } else {
      // Entferne Alternative falls vorhanden
      setAlternativeStakes(prev => {
        const newMap = new Map(prev)
        newMap.delete(matchId)
        return newMap
      })
    }
    
  } catch (error) {
    console.error('Fehler beim Speichern:', error)
    alert('Fehler beim Speichern der Quote')
  } finally {
    setSavingMatchId(null)
  }
}

  const handleAcceptAlternative = (matchId: number) => {
    setModalMatchId(matchId)
    setShowModal(true)
  }

  const handleDeclineAlternative = (matchId: number) => {
    setAlternativeStakes(prev => {
      const newMap = new Map(prev)
      newMap.delete(matchId)
      return newMap
    })
  }

  const handleReduceStake = async (matchId: number, teamToReduce: 'home' | 'away') => {
    const alternative = alternativeStakes.get(matchId)
    if (!alternative) return

    // Finde das Match
    const match = [...bl1Matches, ...bl2Matches].find(m => m.id === matchId)
    if (!match) return

    const teamId = teamToReduce === 'home' ? match.home_team_id : match.away_team_id
    const otherTeamStake = teamToReduce === 'home' ? match.away_stake : match.home_stake
    const newStake = alternative.alternativeAmount - otherTeamStake

    if (newStake < 0) {
      alert('Fehler: Berechneter Einsatz ist negativ!')
      return
    }

    try {
      // Update team_stakes in Supabase
      const { error } = await supabase
        .from('team_stakes')
        .update({ stake: newStake })
        .eq('team_id', teamId)
        .eq('matchday', selectedMatchday)
        .eq('season', '2025')

      if (error) throw error

      // Aktualisiere lokalen State
      const updateMatches = (matches: Match[]) =>
        matches.map(m => {
          if (m.id === matchId) {
            if (teamToReduce === 'home') {
              return {
                ...m,
                home_stake: newStake,
                total_stake: newStake + m.away_stake
              }
            } else {
              return {
                ...m,
                away_stake: newStake,
                total_stake: m.home_stake + newStake
              }
            }
          }
          return m
        })

      setBl1Matches(updateMatches)
      setBl2Matches(updateMatches)

      // Entferne Alternative
      setAlternativeStakes(prev => {
        const newMap = new Map(prev)
        newMap.delete(matchId)
        return newMap
      })

      setShowModal(false)
      setModalMatchId(null)
      
    } catch (error) {
      console.error('Fehler beim Update:', error)
      alert('Fehler beim Anpassen des Einsatzes')
    }
  }

  // Navigation zwischen Spieltagen
  const goToPreviousMatchday = () => {
    const currentIndex = availableMatchdays.indexOf(selectedMatchday)
    if (currentIndex > 0) {
      setSelectedMatchday(availableMatchdays[currentIndex - 1])
    }
  }

  const goToNextMatchday = () => {
    const currentIndex = availableMatchdays.indexOf(selectedMatchday)
    if (currentIndex < availableMatchdays.length - 1) {
      setSelectedMatchday(availableMatchdays[currentIndex + 1])
    }
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

	const BetCard = ({ match }: { match: Match }) => {
  const [oddsInput, setOddsInput] = useState<string>(match.odds?.toString() || '3.40')
  const alternative = alternativeStakes.get(match.id)
  const isAlreadyBet = match.odds !== null && match.odds !== undefined
  const cardRef = useRef<HTMLDivElement>(null)

  // Prüfe welches Team über 250€ hat
  const homeTeamOver250 = match.home_stake > 250
  const awayTeamOver250 = match.away_stake > 250
  const anyTeamOver250 = homeTeamOver250 || awayTeamOver250

  // Berechne Alternative on-the-fly wenn Team über 250€
  const currentOdds = parseFloat(oddsInput) || 3.40
  const calculatedAlternative = anyTeamOver250 ? calculateAlternativeStake(match.total_stake, currentOdds) : null

  useEffect(() => {
    setOddsInput(match.odds?.toString() || '3.40')
  }, [match.odds])

  const handleAbort = async () => {
    try {
      // Bestimme welches Team abgebrochen werden soll
      const teamToAbort = homeTeamOver250 ? 'home' : 'away'
      const teamName = homeTeamOver250 ? match.home_team.short_name : match.away_team.short_name

      // Setze Abbruch in bets Tabelle
      const { error } = await supabase
        .from('bets')
        .update({
          [teamToAbort === 'home' ? 'home_team_abort' : 'away_team_abort']: true
        })
        .eq('match_id', match.id)

      if (error) throw error

      // Entferne Alternative
      setAlternativeStakes(prev => {
        const newMap = new Map(prev)
        newMap.delete(match.id)
        return newMap
      })

      alert(`Abbruch für ${teamName} erfolgreich! Einsatz wird beim nächsten Spieltag auf 0,50 € zurückgesetzt.`)
      
      // Reload data
      window.location.reload()
    } catch (error) {
      console.error('Fehler beim Abbruch:', error)
      alert('Fehler beim Abbruch des Teams')
    }
  }

  const handleQuoteAdjust = () => {
    // Öffne Modal für Anpassung
    handleAcceptAlternative(match.id)
  }

  return (
    <div ref={cardRef} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition">
      <div className="p-4">
        {/* Spielinfo Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="text-xs text-slate-500">
            {match.is_finished ? (
              <span className="px-2 py-1 bg-slate-100 rounded-full">Beendet</span>
            ) : (
              <span>{formatDate(match.match_date)}</span>
            )}
          </div>
          {match.is_finished && match.result && (
            <div className="text-xs">
              {match.result === 'x' ? (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                  Unentschieden
                </span>
              ) : (
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                  {match.result === '1' ? 'Heimsieg' : 'Auswärtssieg'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Teams & Einsätze - KOMPAKTER mit Tab-Stop Ausrichtung */}
<div className="flex items-start gap-4 mb-3">
  {/* Teams mit Einsätzen - Tab-Stop Style */}
  <div className="flex-1 space-y-2">
    {/* Heimteam */}
    <div className="flex items-center">
      <span className={`font-semibold text-sm w-32 ${
        homeTeamOver250 ? 'text-orange-600' : 'text-slate-800'
      }`}>
        {match.home_team.short_name}
      </span>
      <span className={`text-sm font-bold ml-2 ${
        homeTeamOver250 ? 'text-orange-600' : 'text-blue-600'
      }`}>
        {formatCurrency(match.home_stake)}
      </span>
    </div>

    {/* Auswärtsteam */}
    <div className="flex items-center">
      <span className={`font-semibold text-sm w-32 ${
        awayTeamOver250 ? 'text-orange-600' : 'text-slate-800'
      }`}>
        {match.away_team.short_name}
      </span>
      <span className={`text-sm font-bold ml-2 ${
        awayTeamOver250 ? 'text-orange-600' : 'text-blue-600'
      }`}>
        {formatCurrency(match.away_stake)}
      </span>
    </div>
  </div>

  {/* Ergebnis - Links vom Gesamteinsatz */}
  {match.is_finished && (
    <div className="flex flex-col items-center justify-center gap-1 min-w-[40px]">
      <span className="text-base font-bold text-slate-900">
        {match.home_goals}
      </span>
      <span className="text-base font-bold text-slate-900">
        {match.away_goals}
      </span>
    </div>
  )}

  {/* Gesamteinsatz - Rechts */}
  <div className="flex flex-col items-end justify-center min-w-[80px]">
    <span className="text-xs text-slate-500 mb-1">Gesamt</span>
    <span className={`text-lg font-bold ${
      anyTeamOver250 ? 'text-orange-600' : 'text-slate-800'
    }`}>
      {formatCurrency(match.total_stake)}
    </span>
  </div>
</div>

        {/* Quote Input - Kompakt mit SCHWARZER Schrift */}
        <div className="flex items-center gap-2 mb-3 pt-2 border-t border-slate-100">
          <label className="text-xs font-medium text-slate-600 min-w-[40px]">
            Quote
          </label>
          <input
            type="number"
            step="0.01"
            min="1.00"
            max="99.99"
            value={oddsInput}
            onChange={(e) => setOddsInput(e.target.value)}
            disabled={isAlreadyBet}
            className={`flex-1 px-2 py-1.5 text-sm text-slate-900 font-medium border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
              isAlreadyBet 
                ? 'bg-slate-100 border-slate-200 cursor-not-allowed' 
                : 'bg-white border-slate-300'
            }`}
            placeholder="3.40"
          />
          <button
            onClick={() => {
              const odds = parseFloat(oddsInput)
              if (isNaN(odds) || odds < 1 || odds > 99.99) {
                alert('Bitte gültige Quote eingeben (1.00 - 99.99)')
                return
              }
              
              // Speichere Scroll-Position RELATIV zur Card
              const cardElement = cardRef.current
              if (cardElement) {
                const cardTop = cardElement.getBoundingClientRect().top
                const scrollOffset = window.scrollY + cardTop
                
                handleSaveOdds(match.id, odds, match)
                
                setTimeout(() => {
                  window.scrollTo({
                    top: scrollOffset - 100,
                    behavior: 'smooth'
                  })
                }, 100)
              } else {
                handleSaveOdds(match.id, odds, match)
              }
            }}
            disabled={savingMatchId === match.id || isAlreadyBet}
            className={`px-3 py-1.5 text-xs rounded-lg transition font-medium whitespace-nowrap ${
              isAlreadyBet
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:bg-slate-400`}
          >
            {savingMatchId === match.id ? '...' : isAlreadyBet ? 'Bereits getippt' : 'Speichern'}
          </button>
        </div>

        {/* Optionen bei zu hohem Einsatz - ZEIGE IMMER WENN ÜBER 250€ */}
        {anyTeamOver250 && (
          <div className="mt-3 pt-3 border-t border-orange-200 bg-orange-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
            <div className="text-xs font-semibold text-orange-800 mb-2">
              ⚠️ Einsatz über 250€ - Aktion erforderlich:
            </div>
            
            {/* Info welches Team betroffen ist */}
            <div className="text-xs text-slate-600 mb-3">
              {homeTeamOver250 && (
                <span className="font-semibold text-orange-700">
                  {match.home_team.short_name}: {formatCurrency(match.home_stake)}
                </span>
              )}
              {homeTeamOver250 && awayTeamOver250 && <span> und </span>}
              {awayTeamOver250 && (
                <span className="font-semibold text-orange-700">
                  {match.away_team.short_name}: {formatCurrency(match.away_stake)}
                </span>
              )}
            </div>

            {/* Alternative Einsatz Info */}
            {calculatedAlternative && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600">Alternativer Gesamteinsatz:</span>
                  <span className="text-sm font-bold text-orange-700">
                    {formatCurrency(calculatedAlternative)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  Berechnung: ({formatCurrency(match.total_stake)} × 3) ÷ {currentOdds.toFixed(2)}
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleQuoteAdjust}
                className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
              >
                Einsatz anpassen
              </button>
              <button
                onClick={handleAbort}
                className="flex-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
              >
                Abbruch ({homeTeamOver250 ? match.home_team.short_name : match.away_team.short_name})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
	
  // Modal Component
const Modal = () => {
  if (!showModal || !modalMatchId) return null

  const match = [...bl1Matches, ...bl2Matches].find(m => m.id === modalMatchId)
  if (!match) return null

  const alternative = alternativeStakes.get(modalMatchId)

  const handleAbort = async (teamToAbort: 'home' | 'away') => {
    try {
      // Setze Abbruch in bets Tabelle
      const { error } = await supabase
        .from('bets')
        .update({
          [teamToAbort === 'home' ? 'home_team_abort' : 'away_team_abort']: true
        })
        .eq('match_id', modalMatchId)

      if (error) throw error

      // Aktualisiere lokalen State
      const updateMatches = (matches: Match[]) =>
        matches.map(m => {
          if (m.id === modalMatchId) {
            if (teamToAbort === 'home') {
              return {
                ...m,
                home_stake: 0.5, // Wird im nächsten Spieltag auf 0.5 gesetzt
                total_stake: 0.5 + m.away_stake
              }
            } else {
              return {
                ...m,
                away_stake: 0.5,
                total_stake: m.home_stake + 0.5
              }
            }
          }
          return m
        })

      setBl1Matches(updateMatches)
      setBl2Matches(updateMatches)

      // Entferne Alternative
      setAlternativeStakes(prev => {
        const newMap = new Map(prev)
        newMap.delete(modalMatchId)
        return newMap
      })

      setShowModal(false)
      setModalMatchId(null)
      
      alert('Abbruch erfolgreich! Einsatz wird beim nächsten Spieltag auf 0,50 € zurückgesetzt.')
    } catch (error) {
      console.error('Fehler beim Abbruch:', error)
      alert('Fehler beim Abbruch des Teams')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          Einsatz anpassen
        </h3>
        
        <p className="text-sm text-slate-600 mb-6">
          Wählen Sie eine Option für die Einsatzanpassung:
        </p>

        <div className="space-y-3">
          {/* Heimteam */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-slate-800">{match.home_team.short_name}</span>
              <span className="text-sm text-slate-600">
                Aktuell: {formatCurrency(match.home_stake)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleReduceStake(modalMatchId, 'home')}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
              >
                Anpassen
              </button>
              {match.home_stake >= 125 && (
                <button
                  onClick={() => handleAbort('home')}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium"
                >
                  Abbruch
                </button>
              )}
            </div>
          </div>

          {/* Auswärtsteam */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-slate-800">{match.away_team.short_name}</span>
              <span className="text-sm text-slate-600">
                Aktuell: {formatCurrency(match.away_stake)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleReduceStake(modalMatchId, 'away')}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
              >
                Anpassen
              </button>
              {match.away_stake >= 125 && (
                <button
                  onClick={() => handleAbort('away')}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium"
                >
                  Abbruch
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setShowModal(false)
            setModalMatchId(null)
          }}
          className="w-full mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition font-medium"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

  // Berechne Statistiken
  const calculateStats = (matches: Match[]) => {
    const totalStake = matches.reduce((sum, m) => sum + m.total_stake, 0)
    const avgStake = matches.length > 0 ? totalStake / matches.length : 0
    const maxStake = matches.length > 0 ? Math.max(...matches.map(m => m.total_stake)) : 0
    
    return { totalStake, avgStake, maxStake }
  }

  const bl1Stats = calculateStats(bl1Matches)
  const bl2Stats = calculateStats(bl2Matches)
  const overallStats = calculateStats([...bl1Matches, ...bl2Matches])

  const currentIndex = availableMatchdays.indexOf(selectedMatchday)
  const isFirstMatchday = currentIndex === 0
  const isLastMatchday = currentIndex === availableMatchdays.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Spieltag-Auswahl + Pfeilbuttons + Ligen-Toggle */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          {/* Spieltag Navigation */}
          <div className="flex items-end gap-2">
            {/* Vorheriger Spieltag */}
            <button
              onClick={goToPreviousMatchday}
              disabled={isFirstMatchday}
              className={`p-3 rounded-lg border transition ${
                isFirstMatchday
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Vorheriger Spieltag"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Spieltag Dropdown */}
            <div>
              <label htmlFor="matchday" className="block text-sm font-medium text-slate-700 mb-2">
                Spieltag auswählen
              </label>
              <select
                id="matchday"
                value={selectedMatchday}
                onChange={(e) => setSelectedMatchday(Number(e.target.value))}
                className="block px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 font-semibold"
              >
                {availableMatchdays.map(day => (
                  <option key={day} value={day}>
                    {day}. Spieltag
                  </option>
                ))}
              </select>
            </div>

            {/* Nächster Spieltag */}
            <button
              onClick={goToNextMatchday}
              disabled={isLastMatchday}
              className={`p-3 rounded-lg border transition ${
                isLastMatchday
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Nächster Spieltag"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Ligen-Toggle - Verkleinert und rechts */}
          <div className="flex gap-2">
            {/* 1. Bundesliga Toggle */}
            <button
              onClick={() => setShowBl1(!showBl1)}
              className={`px-3 py-2 rounded-lg font-semibold text-xs transition ${
                showBl1
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              1. BL
            </button>

            {/* 2. Bundesliga Toggle */}
            <button
              onClick={() => setShowBl2(!showBl2)}
              className={`px-3 py-2 rounded-lg font-semibold text-xs transition ${
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
            <p className="mt-2 text-slate-600">Lade Wetten...</p>
          </div>
        ) : (
          <>
            {/* Gesamt-Statistiken - Kompakt */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-5">
                <div className="text-xs sm:text-sm text-slate-600 mb-1">Gesamteinsatz</div>
                <div className="text-base sm:text-2xl font-bold text-slate-800">
                  {formatCurrency(overallStats.totalStake)}
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-5">
                <div className="text-xs sm:text-sm text-slate-600 mb-1">Durchschnitt</div>
                <div className="text-base sm:text-2xl font-bold text-slate-800">
                  {formatCurrency(overallStats.avgStake)}
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-5">
                <div className="text-xs sm:text-sm text-slate-600 mb-1">Höchster</div>
                <div className="text-base sm:text-2xl font-bold text-slate-800">
                  {formatCurrency(overallStats.maxStake)}
                </div>
              </div>
            </div>

            {/* 1. Bundesliga */}
            {showBl1 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-800">1. Bundesliga</h2>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {bl1Matches.length} Spiele
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">
                    Gesamt: <span className="font-bold text-slate-800">{formatCurrency(bl1Stats.totalStake)}</span>
                  </div>
                </div>
                
                {bl1Matches.length > 0 ? (
                  <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bl1Matches.map(match => (
                      <BetCard key={match.id} match={match} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">Keine Spiele verfügbar</p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Bundesliga */}
            {showBl2 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-800">2. Bundesliga</h2>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                      {bl2Matches.length} Spiele
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">
                    Gesamt: <span className="font-bold text-slate-800">{formatCurrency(bl2Stats.totalStake)}</span>
                  </div>
                </div>
                
                {bl2Matches.length > 0 ? (
                  <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bl2Matches.map(match => (
                      <BetCard key={match.id} match={match} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">Keine Spiele verfügbar</p>
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

      {/* Modal */}
      <Modal />
    </div>
  )
}