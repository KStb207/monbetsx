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
  odds_x: number | null // <- NEU!
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

// NEU: Interface für API Quoten
interface ApiOdds {
  home: number | null
  draw: number | null
  away: number | null
}

export default function BetsPage() {
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null)
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

  // NEU: API Quoten States
  const [apiOdds, setApiOdds] = useState<Map<number, ApiOdds>>(new Map())
  const [loadingApiOdds, setLoadingApiOdds] = useState(false)

// NEU: Funktion zum Laden der API-Quoten (nur Unentschieden von Tipico)
const fetchOddsFromAPI = async (matches: Match[], leagueKey: string) => {
  setLoadingApiOdds(true)
  try {
    const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${leagueKey}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal&bookmakers=tipico`,
      { next: { revalidate: 3600 } }
    )

    if (!response.ok) {
      console.error('API Error:', response.status)
      return
    }

    const data = await response.json()
    
    // ═══════════════════════════════════════════════════════════
    // DEBUG: Zeige ALLE Spiele die die API zurückgibt
    // ═══════════════════════════════════════════════════════════
    console.log('🎯 ALLE SPIELE IN DER API-RESPONSE:')
    console.log('═'.repeat(80))
    data.forEach((game: any, i: number) => {
      const date = new Date(game.commence_time).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      const hasTipico = game.bookmakers.find((b: any) => b.key === 'tipico')
      console.log(`${i+1}. "${game.home_team}" vs "${game.away_team}"`)
      console.log(`   Datum: ${date}`)
      console.log(`   Tipico: ${hasTipico ? '✅' : '❌'}`)
    })
    console.log('═'.repeat(80))
    console.log(`\n📊 Gesamt: ${data.length} Spiele gefunden\n`)
    
    const newOddsMap = new Map<number, ApiOdds>()

    // Matche die API-Daten mit deinen Spielen
    matches.forEach(match => {
      console.log('─'.repeat(80))
      console.log(`🔍 Suche Match für: ${match.home_team.short_name} vs ${match.away_team.short_name}`)
      console.log(`   DB Home odds_api_id: "${match.home_team.odds_api_id}"`)
      console.log(`   DB Away odds_api_id: "${match.away_team.odds_api_id}"`)
      
      const apiMatch = data.find((game: any) => {
  // Test nur für das erste Spiel
  if (match.home_team.short_name === 'Düsseldorf') {
    console.log('🔬 BYTE-VERGLEICH für Düsseldorf:')
    console.log('─'.repeat(60))
    console.log('Home Team Vergleich:')
    console.log(`  DB: "${match.home_team.odds_api_id}"`)
    console.log(`  API: "${game.home_team}"`)
    console.log(`  Typ DB: ${typeof match.home_team.odds_api_id}`)
    console.log(`  Typ API: ${typeof game.home_team}`)
    console.log(`  Länge DB: ${match.home_team.odds_api_id?.length}`)
    console.log(`  Länge API: ${game.home_team.length}`)
    console.log(`  Bytes DB: [${Array.from(match.home_team.odds_api_id || '').map(c => c.charCodeAt(0)).join(',')}]`)
    console.log(`  Bytes API: [${Array.from(game.home_team).map(c => c.charCodeAt(0)).join(',')}]`)
    console.log(`  === Vergleich: ${match.home_team.odds_api_id === game.home_team}`)
    console.log(`  == Vergleich: ${match.home_team.odds_api_id == game.home_team}`)
    console.log(`  Trimmed ===: ${match.home_team.odds_api_id?.trim() === game.home_team.trim()}`)
    console.log('─'.repeat(60))
  }
  
  // Originales Matching
  const homeMatch = (match.home_team.odds_api_id && game.home_team.trim() === match.home_team.odds_api_id.trim()) ||
                 game.home_team.trim() === match.home_team.name?.trim() || 
                 game.home_team.trim() === match.home_team.short_name?.trim()

const awayMatch = (match.away_team.odds_api_id && game.away_team.trim() === match.away_team.odds_api_id.trim()) ||
                 game.away_team.trim() === match.away_team.name?.trim() || 
                 game.away_team.trim() === match.away_team.short_name?.trim()
  
  return homeMatch && awayMatch
})

      if (apiMatch && apiMatch.bookmakers && apiMatch.bookmakers.length > 0) {
        console.log(`✅ API Match gefunden: "${apiMatch.home_team}" vs "${apiMatch.away_team}"`)
        
        const tipicoBookmaker = apiMatch.bookmakers.find((b: any) => b.key === 'tipico')
        
        if (tipicoBookmaker) {
          const h2hMarket = tipicoBookmaker.markets.find((m: any) => m.key === 'h2h')
          
          if (h2hMarket && h2hMarket.outcomes) {
            const drawOdds = h2hMarket.outcomes.find((o: any) => o.name === 'Draw')

            newOddsMap.set(match.id, {
              home: null,
              draw: drawOdds?.price || null,
              away: null
            })
            
            console.log(`   ✅ Tipico X-Quote: ${drawOdds?.price}`)
          }
        } else {
          console.log(`   ⚠️ Tipico nicht verfügbar für dieses Spiel`)
        }
      } else {
        console.log(`   ❌ Kein Match in API gefunden`)
        console.log(`   💡 Mögliche Gründe:`)
        console.log(`      - Spiel ist zeitlich zu weit weg`)
        console.log(`      - odds_api_id stimmt nicht mit API-Namen überein`)
        console.log(`      - Spiel ist bereits vorbei`)
      }
    })
    
    console.log('═'.repeat(80))
    console.log(`\n📊 ERGEBNIS: ${newOddsMap.size} von ${matches.length} Spielen gematched\n`)
    console.log('═'.repeat(80))

    setApiOdds(prev => new Map([...prev, ...newOddsMap]))
  } catch (error) {
    console.error('❌ Fehler beim Laden der API-Quoten:', error)
  } finally {
    setLoadingApiOdds(false)
  }
}

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
        
        const now = new Date()
        const upcomingMatches = data
          .filter(match => new Date(match.match_date) >= now && !match.is_finished)
          .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
        
        if (upcomingMatches.length > 0) {
          setSelectedMatchday(upcomingMatches[0].matchday)
        } else {
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
      
      const { data: bl1Data } = await supabase
        .from('matches')
        .select(`
          *,
		  odds_x,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name, odds_api_id),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name, odds_api_id)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', 'bl1')
        .order('match_date', { ascending: true })
      
      const { data: bl2Data } = await supabase
        .from('matches')
        .select(`
          *,
		  odds_x,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name, odds_api_id),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name, odds_api_id)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', 'bl2')
        .order('match_date', { ascending: true })
      
      const { data: stakes } = await supabase
        .from('team_stakes')
        .select('team_id, stake')
        .eq('matchday', selectedMatchday)
        .eq('season', '2025')
      
      const allMatchIds = [
        ...(bl1Data?.map(m => m.id) || []),
        ...(bl2Data?.map(m => m.id) || [])
      ]
      
      const { data: bets } = await supabase
        .from('bets')
        .select('match_id, odds')
        .in('match_id', allMatchIds)
      
      const stakesMap = new Map(stakes?.map(s => [s.team_id, s.stake]) || [])
      const betsMap = new Map(bets?.map(b => [b.match_id, b.odds]) || [])
      
      const enrichMatches = (matches: any[]): Match[] => {
        return matches.map(match => ({
          ...match,
          home_stake: stakesMap.get(match.home_team_id) || 0,
          away_stake: stakesMap.get(match.away_team_id) || 0,
          total_stake: (stakesMap.get(match.home_team_id) || 0) + (stakesMap.get(match.away_team_id) || 0),
          odds: betsMap.get(match.id) || null
        }))
      }
      
      if (bl1Data) {
        const enrichedBl1 = enrichMatches(bl1Data)
        setBl1Matches(enrichedBl1)
        // NEU: Lade API-Quoten für 1. Bundesliga
        fetchOddsFromAPI(enrichedBl1, 'soccer_germany_bundesliga')
      }
      
      if (bl2Data) {
        const enrichedBl2 = enrichMatches(bl2Data)
        setBl2Matches(enrichedBl2)
        // NEU: Lade API-Quoten für 2. Bundesliga
        fetchOddsFromAPI(enrichedBl2, 'soccer_germany_bundesliga2')
      }
      
      setLoading(false)
    }
    
    if (selectedMatchday !== null) {
      fetchMatchesWithStakes()
    }
  }, [selectedMatchday])

  const calculateAlternativeStake = (totalStake: number, odds: number): number => {
    return (totalStake * 3) / odds
  }

  const handleSaveOdds = async (matchId: number, odds: number, match: Match) => {
    setSavingMatchId(matchId)
    
    try {
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
      
      const updateMatches = (matches: Match[]) =>
        matches.map(m => m.id === matchId ? { ...m, odds } : m)
      
      setBl1Matches(updateMatches)
      setBl2Matches(updateMatches)
      
      if (match.home_stake > 250 || match.away_stake > 250) {
        const alternative = calculateAlternativeStake(match.total_stake, odds)
        setAlternativeStakes(prev => new Map(prev).set(matchId, {
          matchId,
          alternativeAmount: alternative,
          originalStake: match.total_stake,
          quote: odds
        }))
      } else {
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
      const { error } = await supabase
        .from('team_stakes')
        .update({ stake: newStake })
        .eq('team_id', teamId)
        .eq('matchday', selectedMatchday)
        .eq('season', '2025')

      if (error) throw error

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

  const goToPreviousMatchday = () => {
    const currentIndex = availableMatchdays.indexOf(selectedMatchday!)
    if (currentIndex > 0) {
      setSelectedMatchday(availableMatchdays[currentIndex - 1])
    }
  }

  const goToNextMatchday = () => {
    const currentIndex = availableMatchdays.indexOf(selectedMatchday!)
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
    // NEU: Hole API-Quoten für dieses Spiel
    const matchApiOdds = apiOdds.get(match.id)
    
    // NEU: Verwende Tipico X-Quote als Default, falls verfügbar
    const defaultOdds = matchApiOdds?.draw || match.odds || match.odds_x.toFixed(2)
    const [oddsInput, setOddsInput] = useState<string>(defaultOdds.toString())
    
    const alternative = alternativeStakes.get(match.id)
    const isAlreadyBet = match.odds !== null && match.odds !== undefined
    const cardRef = useRef<HTMLDivElement>(null)

    const matchDate = new Date(match.match_date)
    const now = new Date()
    const hasMatchStarted = matchDate <= now
    const canBet = !hasMatchStarted && !isAlreadyBet

    const homeTeamOver250 = match.home_stake > 250
    const awayTeamOver250 = match.away_stake > 250
    const anyTeamOver250 = homeTeamOver250 || awayTeamOver250

    const currentOdds = parseFloat(oddsInput) || match.odds_x.toFixed(2)
    const calculatedAlternative = anyTeamOver250 ? calculateAlternativeStake(match.total_stake, currentOdds) : null

    useEffect(() => {
      // Update input wenn API-Quoten geladen wurden oder Match odds sich ändern
      if (matchApiOdds?.draw && !match.odds) {
        setOddsInput(matchApiOdds.draw.toString())
      } else if (match.odds) {
        setOddsInput(match.odds.toString())
      }
    }, [match.odds, matchApiOdds])

    const handleAbort = async () => {
      try {
        const teamToAbort = homeTeamOver250 ? 'home' : 'away'
        const teamName = homeTeamOver250 ? match.home_team.short_name : match.away_team.short_name

        const { error } = await supabase
          .from('bets')
          .update({
            [teamToAbort === 'home' ? 'home_team_abort' : 'away_team_abort']: true
          })
          .eq('match_id', match.id)

        if (error) throw error

        setAlternativeStakes(prev => {
          const newMap = new Map(prev)
          newMap.delete(match.id)
          return newMap
        })

        alert(`Abbruch für ${teamName} erfolgreich! Einsatz wird beim nächsten Spieltag auf 1€ zurückgesetzt.`)
        window.location.reload()
      } catch (error) {
        console.error('Fehler beim Abbruch:', error)
        alert('Fehler beim Abbruch des Teams')
      }
    }

    const handleQuoteAdjust = () => {
      handleAcceptAlternative(match.id)
    }

    return (
      <div ref={cardRef} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition">
        <div className="p-3 sm:p-4">
          {/* Spielinfo Header */}
          <div className="flex items-center justify-between mb-2 sm:mb-3 pb-2 border-b border-slate-100">
            <div className="text-xs text-slate-500">
              {match.is_finished ? (
                <span className="px-2 py-1 bg-slate-100 rounded-full">Beendet</span>
              ) : hasMatchStarted ? (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold">Läuft</span>
              ) : (
                <span>{formatDate(match.match_date)}</span>
              )}
            </div>
            <div className="text-xs font-semibold text-slate-600">
              {match.league_shortcut.toUpperCase()}
            </div>
          </div>

          {/* Teams */}
          <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
            {/* Heimteam */}
            <div className="flex items-center justify-between">
              <span className={`text-sm sm:text-base font-semibold ${homeTeamOver250 ? 'text-orange-600' : 'text-slate-800'}`}>
                {match.home_team.short_name}
              </span>
              <span className={`text-xs sm:text-sm font-bold ${homeTeamOver250 ? 'text-orange-600' : 'text-slate-600'}`}>
                {formatCurrency(match.home_stake)}
              </span>
            </div>

            {/* Auswärtsteam */}
            <div className="flex items-center justify-between">
              <span className={`text-sm sm:text-base font-semibold ${awayTeamOver250 ? 'text-orange-600' : 'text-slate-800'}`}>
                {match.away_team.short_name}
              </span>
              <span className={`text-xs sm:text-sm font-bold ${awayTeamOver250 ? 'text-orange-600' : 'text-slate-600'}`}>
                {formatCurrency(match.away_stake)}
              </span>
            </div>
          </div>

          {/* Gesamteinsatz */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mb-2 sm:mb-3">
            <span className="text-xs sm:text-sm text-slate-600">Gesamteinsatz:</span>
            <span className={`text-sm sm:text-base font-bold ${anyTeamOver250 ? 'text-orange-600' : 'text-blue-700'}`}>
              {formatCurrency(match.total_stake)}
            </span>
          </div>

          {/* Quote Input & Save Button */}
          {canBet && (
            <div className="flex gap-1.5 sm:gap-2">
              <input
                type="number"
                step="0.01"
                min="1.01"
                max="100"
                value={oddsInput}
                onChange={(e) => setOddsInput(e.target.value)}
                className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Quote"
              />
              <button
                onClick={() => {
                  const odds = parseFloat(oddsInput)
                  if (odds >= 1.01 && odds <= 100) {
                    handleSaveOdds(match.id, odds, match)
                  } else {
                    alert('Bitte eine Quote zwischen 1.01 und 100 eingeben')
                  }
                }}
                disabled={savingMatchId === match.id}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition font-semibold text-xs sm:text-sm whitespace-nowrap"
              >
                {savingMatchId === match.id ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          )}

          {/* NEU: Tipico X-Quote Anzeige - nur Unentschieden */}
          {canBet && matchApiOdds?.draw && (
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-slate-600 font-medium">Tipico Quote (X):</span>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-slate-700">
                    {matchApiOdds.draw.toFixed(2)}
                  </span>
                  {loadingApiOdds && (
                    <div className="text-[10px] text-slate-400">Lädt...</div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Info wenn keine Tipico-Quote verfügbar */}
          {canBet && !matchApiOdds?.draw && !loadingApiOdds && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="text-[10px] sm:text-xs text-amber-700">
                ⚠️ Keine Tipico-Quote verfügbar
              </div>
            </div>
          )}

          {/* Bereits getippt */}
          {isAlreadyBet && !hasMatchStarted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-green-800 font-semibold">✓ Getippt</span>
                <span className="text-sm sm:text-base font-bold text-green-700">{match.odds?.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Spiel gestartet - keine Tipps mehr möglich */}
          {hasMatchStarted && !match.is_finished && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-red-800 font-semibold text-center">
                Spiel bereits gestartet - keine Tipps mehr möglich
              </div>
            </div>
          )}

          {/* Alternative Stake Anzeige */}
          {anyTeamOver250 && canBet && (
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-orange-200 bg-orange-50 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 px-3 sm:px-4 py-2 sm:py-3 rounded-b-lg">
              <div className="text-[10px] sm:text-xs font-semibold text-orange-800 mb-1 sm:mb-2">
                ⚠️ Einsatz über 250€ - Aktion erforderlich:
              </div>
              
              <div className="text-[10px] sm:text-xs text-slate-600 mb-2 sm:mb-3">
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

              {calculatedAlternative && (
                <>
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="text-[10px] sm:text-xs text-slate-600">Alternativer Gesamteinsatz:</span>
                    <span className="text-xs sm:text-sm font-bold text-orange-700">
                      {formatCurrency(calculatedAlternative)}
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mb-2 sm:mb-3">
                    Berechnung: ({formatCurrency(match.total_stake)} × 3) ÷ {currentOdds.toFixed(2)}
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                <button
                  onClick={handleQuoteAdjust}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Einsatz anpassen
                </button>
                <button
                  onClick={handleAbort}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
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
        const { error } = await supabase
          .from('bets')
          .update({
            [teamToAbort === 'home' ? 'home_team_abort' : 'away_team_abort']: true
          })
          .eq('match_id', modalMatchId)

        if (error) throw error

        const updateMatches = (matches: Match[]) =>
          matches.map(m => {
            if (m.id === modalMatchId) {
              if (teamToAbort === 'home') {
                return {
                  ...m,
                  home_stake: 1,
                  total_stake: 1 + m.away_stake
                }
              } else {
                return {
                  ...m,
                  away_stake: 1,
                  total_stake: m.home_stake + 1
                }
              }
            }
            return m
          })

        setBl1Matches(updateMatches)
        setBl2Matches(updateMatches)

        setAlternativeStakes(prev => {
          const newMap = new Map(prev)
          newMap.delete(modalMatchId)
          return newMap
        })

        setShowModal(false)
        setModalMatchId(null)
        
        alert('Abbruch erfolgreich! Einsatz wird beim nächsten Spieltag auf 1€ zurückgesetzt.')
      } catch (error) {
        console.error('Fehler beim Abbruch:', error)
        alert('Fehler beim Abbruch des Teams')
      }
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">
            Einsatz anpassen
          </h3>
          
          <p className="text-xs sm:text-sm text-slate-600 mb-4 sm:mb-6">
            Wählen Sie eine Option für die Einsatzanpassung:
          </p>

          <div className="space-y-2 sm:space-y-3">
            {/* Heimteam */}
            <div className="border border-slate-200 rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-center mb-2 sm:mb-3">
                <span className="font-semibold text-sm sm:text-base text-slate-800">{match.home_team.short_name}</span>
                <span className="text-xs sm:text-sm text-slate-600">
                  Aktuell: {formatCurrency(match.home_stake)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReduceStake(modalMatchId, 'home')}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs sm:text-sm font-medium"
                >
                  Anpassen
                </button>
                {match.home_stake >= 125 && (
                  <button
                    onClick={() => handleAbort('home')}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs sm:text-sm font-medium"
                  >
                    Abbruch
                  </button>
                )}
              </div>
            </div>

            {/* Auswärtsteam */}
            <div className="border border-slate-200 rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-center mb-2 sm:mb-3">
                <span className="font-semibold text-sm sm:text-base text-slate-800">{match.away_team.short_name}</span>
                <span className="text-xs sm:text-sm text-slate-600">
                  Aktuell: {formatCurrency(match.away_stake)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReduceStake(modalMatchId, 'away')}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs sm:text-sm font-medium"
                >
                  Anpassen
                </button>
                {match.away_stake >= 125 && (
                  <button
                    onClick={() => handleAbort('away')}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs sm:text-sm font-medium"
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
            className="w-full mt-3 sm:mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition font-medium text-xs sm:text-sm"
          >
            Abbrechen
          </button>
        </div>
      </div>
    )
  }

  const calculateStats = (matches: Match[]) => {
    const totalStake = matches.reduce((sum, m) => sum + m.total_stake, 0)
    const avgStake = matches.length > 0 ? totalStake / matches.length : 0
    const maxStake = matches.length > 0 ? Math.max(...matches.map(m => m.total_stake)) : 0
    
    return { totalStake, avgStake, maxStake }
  }

  const bl1Stats = calculateStats(bl1Matches)
  const bl2Stats = calculateStats(bl2Matches)
  const overallStats = calculateStats([...bl1Matches, ...bl2Matches])

  const currentIndex = selectedMatchday !== null ? availableMatchdays.indexOf(selectedMatchday) : -1
  const isFirstMatchday = currentIndex === 0
  const isLastMatchday = currentIndex === availableMatchdays.length - 1

  if (selectedMatchday === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Lade aktuellen Spieltag...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:px-8">
        {/* Spieltag-Auswahl + Pfeilbuttons + Ligen-Toggle */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="flex items-end gap-2 flex-1 min-w-0">
            <button
              onClick={goToPreviousMatchday}
              disabled={isFirstMatchday}
              className={`p-2 sm:p-3 rounded-lg border transition flex-shrink-0 ${
                isFirstMatchday
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Vorheriger Spieltag"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <label htmlFor="matchday" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                Spieltag
              </label>
              <select
                id="matchday"
                value={selectedMatchday}
                onChange={(e) => setSelectedMatchday(Number(e.target.value))}
                className="block w-full px-2 sm:px-4 py-2 sm:py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 font-semibold text-xs sm:text-base"
              >
                {availableMatchdays.map(day => (
                  <option key={day} value={day}>
                    {day}. Spieltag
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={goToNextMatchday}
              disabled={isLastMatchday}
              className={`p-2 sm:p-3 rounded-lg border transition flex-shrink-0 ${
                isLastMatchday
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Nächster Spieltag"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 justify-center sm:justify-start">
            <button
              onClick={() => setShowBl1(!showBl1)}
              className={`px-3 sm:px-3 py-2 rounded-lg font-semibold text-[10px] sm:text-xs transition flex-1 sm:flex-none ${
                showBl1
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              1. BL
            </button>

            <button
              onClick={() => setShowBl2(!showBl2)}
              className={`px-3 sm:px-3 py-2 rounded-lg font-semibold text-[10px] sm:text-xs transition flex-1 sm:flex-none ${
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
            <p className="mt-2 text-slate-600 text-sm">Lade Wetten...</p>
          </div>
        ) : (
          <>
            {/* Gesamt-Statistiken */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-4 mb-4 sm:mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Gesamt</div>
                <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">
                  {formatCurrency(overallStats.totalStake)}
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Ø</div>
                <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">
                  {formatCurrency(overallStats.avgStake)}
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Max</div>
                <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">
                  {formatCurrency(overallStats.maxStake)}
                </div>
              </div>
            </div>

            {/* 1. Bundesliga */}
            {showBl1 && (
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-base sm:text-xl font-bold text-slate-800">1. Bundesliga</h2>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs font-semibold">
                      {bl1Matches.length} Spiele
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs md:text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{formatCurrency(bl1Stats.totalStake)}</span>
                  </div>
                </div>
                
                {bl1Matches.length > 0 ? (
                  <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bl1Matches.map(match => (
                      <BetCard key={match.id} match={match} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
                    <p className="text-slate-500 text-sm">Keine Spiele verfügbar</p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Bundesliga */}
            {showBl2 && (
              <div>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-base sm:text-xl font-bold text-slate-800">2. Bundesliga</h2>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] sm:text-xs font-semibold">
                      {bl2Matches.length} Spiele
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs md:text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{formatCurrency(bl2Stats.totalStake)}</span>
                  </div>
                </div>
                
                {bl2Matches.length > 0 ? (
                  <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bl2Matches.map(match => (
                      <BetCard key={match.id} match={match} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
                    <p className="text-slate-500 text-sm">Keine Spiele verfügbar</p>
                  </div>
                )}
              </div>
            )}

            {!showBl1 && !showBl2 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 sm:p-12 text-center">
                <p className="text-slate-500 text-sm">Bitte mindestens eine Liga auswählen</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal />
    </div>
  )
}