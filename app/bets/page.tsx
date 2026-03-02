'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'bl1',     label: '1. BL',    name: '1. Bundesliga',   oddsKey: 'soccer_germany_bundesliga',  season: '2025', color: 'blue' },
  { key: 'bl2',     label: '2. BL',    name: '2. Bundesliga',   oddsKey: 'soccer_germany_bundesliga2', season: '2025', color: 'slate' },
  { key: 'epl',     label: 'EPL',      name: 'Premier League',  oddsKey: 'soccer_epl',                 season: '2025', color: 'purple' },
  { key: 'la_liga', label: 'La Liga',  name: 'La Liga',         oddsKey: 'soccer_spain_la_liga',       season: '2025', color: 'red' },
  { key: 'serie_a', label: 'Serie A',  name: 'Serie A',         oddsKey: 'soccer_italy_serie_a',       season: '2025', color: 'green' },
  { key: 'ligue_1', label: 'Ligue 1',  name: 'Ligue 1',         oddsKey: 'soccer_france_ligue_one',      season: '2025', color: 'indigo' },
] as const

type LeagueKey = typeof LEAGUES[number]['key']

// ─── Tab-Farben ────────────────────────────────────────────────────────────────
const TAB_ACTIVE: Record<string, string> = {
  blue:   'bg-blue-600 text-white shadow-sm',
  slate:  'bg-slate-700 text-white shadow-sm',
  purple: 'bg-purple-600 text-white shadow-sm',
  red:    'bg-red-600 text-white shadow-sm',
  green:  'bg-green-600 text-white shadow-sm',
  indigo: 'bg-indigo-600 text-white shadow-sm',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
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
    odds_api_id?: string
  }
  away_team: {
    id: number
    name: string
    short_name: string
    odds_api_id?: string
  }
  home_stake: number
  away_stake: number
  total_stake: number
  odds: number | null
  odds_x: number | null
  bet_total_stake: number | null
}

interface AlternativeStake {
  matchId: number
  alternativeAmount: number
  originalStake: number
  quote: number
}

interface ApiOdds {
  home: number | null
  draw: number | null
  away: number | null
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function BetsPage() {
  const [activeLeague, setActiveLeague] = useState<LeagueKey>('bl1')
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [availableMatchdays, setAvailableMatchdays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null)

  const [alternativeStakes, setAlternativeStakes] = useState<Map<number, AlternativeStake>>(new Map())
  const [showModal, setShowModal] = useState(false)
  const [modalMatchId, setModalMatchId] = useState<number | null>(null)

  const [apiOdds, setApiOdds] = useState<Map<number, ApiOdds>>(new Map())
  const [loadingApiOdds, setLoadingApiOdds] = useState(false)

  const leagueConfig = LEAGUES.find(l => l.key === activeLeague)!

  // ─── Beim Liga-Wechsel: Matchdays neu laden ──────────────────────────────────
  useEffect(() => {
    setSelectedMatchday(null)
    setMatches([])
    setApiOdds(new Map())

    async function fetchMatchdays() {
      const { data } = await supabase
        .from('matches')
        .select('matchday, match_date, is_finished')
        .eq('league_shortcut', activeLeague)
        .order('matchday', { ascending: true })

      if (data) {
        const uniqueMatchdays = [...new Set(data.map(m => m.matchday))].sort((a, b) => a - b)
        setAvailableMatchdays(uniqueMatchdays)

        const now = new Date()
        const upcoming = data
          .filter(m => new Date(m.match_date) >= now && !m.is_finished)
          .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())

        if (upcoming.length > 0) {
          setSelectedMatchday(upcoming[0].matchday)
        } else {
          setSelectedMatchday(uniqueMatchdays[uniqueMatchdays.length - 1] ?? null)
        }
      }
    }
    fetchMatchdays()
  }, [activeLeague])

  // ─── Spiele & Stakes laden ────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedMatchday === null) return

    async function fetchMatchesWithStakes() {
      setLoading(true)

      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name, odds_api_id),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name, odds_api_id)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', activeLeague)
        .order('match_date', { ascending: true })

      const { data: stakes } = await supabase
        .from('team_stakes')
        .select('team_id, stake')
        .eq('matchday', selectedMatchday)
        .eq('season', leagueConfig.season)

      const matchIds = matchData?.map(m => m.id) || []

      const { data: bets } = await supabase
        .from('bets')
        .select('match_id, odds, total_stake')
        .in('match_id', matchIds)

      const stakesMap = new Map(stakes?.map(s => [s.team_id, s.stake]) || [])
      const betsMap = new Map(bets?.map(b => [b.match_id, { odds: b.odds, total_stake: b.total_stake }]) || [])

      const enriched: Match[] = (matchData || []).map(match => {
        const betData = betsMap.get(match.id)
        return {
          ...match,
          home_stake: stakesMap.get(match.home_team_id) || 0,
          away_stake: stakesMap.get(match.away_team_id) || 0,
          total_stake: (stakesMap.get(match.home_team_id) || 0) + (stakesMap.get(match.away_team_id) || 0),
          odds: betData?.odds || null,
          bet_total_stake: betData?.total_stake || null,
        }
      })

      setMatches(enriched)

      // Client-seitige Odds als Fallback (falls odds_x noch nicht in DB)
      const missingOdds = enriched.filter(m => !m.odds_x)
      if (missingOdds.length > 0) {
        fetchOddsFromAPI(missingOdds, leagueConfig.oddsKey)
      }

      setLoading(false)
    }

    fetchMatchesWithStakes()
  }, [selectedMatchday, activeLeague])

  // ─── API-Quoten client-seitig laden ──────────────────────────────────────────
  const fetchOddsFromAPI = async (matchList: Match[], leagueKey: string) => {
    setLoadingApiOdds(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${leagueKey}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal&bookmakers=tipico_de`,
        { next: { revalidate: 3600 } }
      )
      if (!response.ok) return

      const data = await response.json()
      const newOddsMap = new Map<number, ApiOdds>()

      matchList.forEach(match => {
        const apiMatch = data.find((game: any) => {
          const homeMatch =
            (match.home_team.odds_api_id && game.home_team === match.home_team.odds_api_id) ||
            game.home_team === match.home_team.name ||
            game.home_team === match.home_team.short_name
          const awayMatch =
            (match.away_team.odds_api_id && game.away_team === match.away_team.odds_api_id) ||
            game.away_team === match.away_team.name ||
            game.away_team === match.away_team.short_name
          return homeMatch && awayMatch
        })

        if (apiMatch?.bookmakers?.length > 0) {
          const tipico = apiMatch.bookmakers.find((b: any) => b.key === 'tipico_de')
          if (tipico) {
            const h2h = tipico.markets.find((m: any) => m.key === 'h2h')
            const drawOdds = h2h?.outcomes.find((o: any) => o.name === 'Draw')
            if (drawOdds) {
              newOddsMap.set(match.id, { home: null, draw: drawOdds.price, away: null })
            }
          }
        }
      })

      setApiOdds(prev => new Map([...prev, ...newOddsMap]))
    } catch (e) {
      console.error('Fehler beim Laden der API-Quoten:', e)
    } finally {
      setLoadingApiOdds(false)
    }
  }

  // ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
  const calculateAlternativeStake = (totalStake: number, odds: number) => (totalStake * 3) / odds

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  const goToPreviousMatchday = () => {
    const idx = availableMatchdays.indexOf(selectedMatchday!)
    if (idx > 0) setSelectedMatchday(availableMatchdays[idx - 1])
  }

  const goToNextMatchday = () => {
    const idx = availableMatchdays.indexOf(selectedMatchday!)
    if (idx < availableMatchdays.length - 1) setSelectedMatchday(availableMatchdays[idx + 1])
  }

  const currentIndex = selectedMatchday !== null ? availableMatchdays.indexOf(selectedMatchday) : -1
  const isFirstMatchday = currentIndex === 0
  const isLastMatchday = currentIndex === availableMatchdays.length - 1

  // ─── Einsatz speichern ────────────────────────────────────────────────────────
  const handleSaveOdds = async (matchId: number, stake: number, match: Match) => {
    setSavingMatchId(matchId)
    try {
      const { error } = await supabase.from('bets').upsert({
        match_id: matchId,
        matchday: selectedMatchday,
        season: leagueConfig.season,
        odds: stake,
        home_stake: match.home_stake,
        away_stake: match.away_stake,
        total_stake: stake,
      }, { onConflict: 'match_id' })

      if (error) throw error

      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, odds: stake, bet_total_stake: stake } : m))

      if (match.home_stake > 250 || match.away_stake > 250) {
        const alternative = calculateAlternativeStake(match.total_stake, stake)
        setAlternativeStakes(prev => new Map(prev).set(matchId, {
          matchId, alternativeAmount: alternative, originalStake: match.total_stake, quote: stake,
        }))
      } else {
        setAlternativeStakes(prev => { const m = new Map(prev); m.delete(matchId); return m })
      }
    } catch (e) {
      console.error('Fehler beim Speichern:', e)
      alert('Fehler beim Speichern der Quote!')
    } finally {
      setSavingMatchId(null)
    }
  }

  const handleAcceptAlternative = (matchId: number) => {
    setModalMatchId(matchId)
    setShowModal(true)
  }

  const handleDeclineAlternative = (matchId: number) => {
    setAlternativeStakes(prev => { const m = new Map(prev); m.delete(matchId); return m })
  }

  const handleReduceStake = async (matchId: number, teamToReduce: 'home' | 'away') => {
    const alternative = alternativeStakes.get(matchId)
    if (!alternative) return
    const match = matches.find(m => m.id === matchId)
    if (!match) return

    const teamId = teamToReduce === 'home' ? match.home_team_id : match.away_team_id
    const otherTeamStake = teamToReduce === 'home' ? match.away_stake : match.home_stake
    const newStake = alternative.alternativeAmount - otherTeamStake

    if (newStake < 0) { alert('Fehler: Berechneter Einsatz ist negativ!'); return }

    try {
      const { error } = await supabase.from('team_stakes')
        .update({ stake: newStake })
        .eq('team_id', teamId)
        .eq('matchday', selectedMatchday)
        .eq('season', leagueConfig.season)

      if (error) throw error

      setMatches(prev => prev.map(m => {
        if (m.id !== matchId) return m
        return teamToReduce === 'home'
          ? { ...m, home_stake: newStake, total_stake: newStake + m.away_stake }
          : { ...m, away_stake: newStake, total_stake: m.home_stake + newStake }
      }))

      setAlternativeStakes(prev => { const nm = new Map(prev); nm.delete(matchId); return nm })
      setShowModal(false)
      setModalMatchId(null)
    } catch (e) {
      console.error('Fehler beim Update:', e)
      alert('Fehler beim Anpassen des Einsatzes')
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const stats = {
    total: matches.reduce((s, m) => s + m.total_stake, 0),
    avg: matches.length > 0 ? matches.reduce((s, m) => s + m.total_stake, 0) / matches.length : 0,
    max: matches.length > 0 ? Math.max(...matches.map(m => m.total_stake)) : 0,
  }

  // ─── BetCard ──────────────────────────────────────────────────────────────────
  const BetCard = ({ match }: { match: Match }) => {
    const matchApiOdds = apiOdds.get(match.id)
    const effectiveOddsX = match.odds_x ?? matchApiOdds?.draw ?? null

    const defaultStake = match.odds || match.total_stake
    const [oddsInput, setOddsInput] = useState<string>(defaultStake.toString())

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

    const currentOdds = parseFloat(oddsInput) || 3.40
    const calculatedAlternative = anyTeamOver250 ? calculateAlternativeStake(match.total_stake, currentOdds) : null

    useEffect(() => {
      if (match.odds) {
        setOddsInput(match.odds.toString())
      } else {
        setOddsInput(match.total_stake.toString())
      }
    }, [match.odds, match.total_stake])

    const handleAbort = async () => {
      try {
        const teamToAbort = homeTeamOver250 ? 'home' : 'away'
        const teamName = homeTeamOver250 ? match.home_team.short_name : match.away_team.short_name

        const { error } = await supabase.from('bets')
          .update({ [teamToAbort === 'home' ? 'home_team_abort' : 'away_team_abort']: true })
          .eq('match_id', match.id)

        if (error) throw error

        setAlternativeStakes(prev => { const m = new Map(prev); m.delete(match.id); return m })
        alert(`Abbruch für ${teamName} erfolgreich! Einsatz wird beim nächsten Spieltag auf 1€ zurückgesetzt.`)
        window.location.reload()
      } catch (e) {
        console.error('Fehler beim Abbruch:', e)
        alert('Fehler beim Abbruch des Teams')
      }
    }

    return (
      <div ref={cardRef} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition">
        <div className="p-3 sm:p-4">
          {/* Header */}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm sm:text-base font-semibold ${homeTeamOver250 ? 'text-orange-600' : 'text-slate-800'}`}>
                  {match.home_team.short_name}
                </span>
                {(hasMatchStarted || match.is_finished) && match.home_goals !== null && (
                  <span className="text-lg sm:text-xl font-bold text-slate-700">{match.home_goals}</span>
                )}
              </div>
              <span className={`text-xs sm:text-sm font-bold ${homeTeamOver250 ? 'text-orange-600' : 'text-slate-600'}`}>
                {formatCurrency(match.home_stake)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm sm:text-base font-semibold ${awayTeamOver250 ? 'text-orange-600' : 'text-slate-800'}`}>
                  {match.away_team.short_name}
                </span>
                {(hasMatchStarted || match.is_finished) && match.away_goals !== null && (
                  <span className="text-lg sm:text-xl font-bold text-slate-700">{match.away_goals}</span>
                )}
              </div>
              <span className={`text-xs sm:text-sm font-bold ${awayTeamOver250 ? 'text-orange-600' : 'text-slate-600'}`}>
                {formatCurrency(match.away_stake)}
              </span>
            </div>
          </div>

          {/* Tipico Quote */}
          {effectiveOddsX ? (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm text-slate-600">Tipico Quote (X):</span>
              <span className="text-sm sm:text-base font-bold text-green-700">{effectiveOddsX.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm text-amber-700">⚠️ Keine Tipico-Quote</span>
              <span className="text-xs sm:text-sm font-bold text-slate-600">Einsatz: {formatCurrency(match.total_stake)}</span>
            </div>
          )}

          {/* Gesetzter Gesamteinsatz */}
          {match.bet_total_stake && (
            <div className="flex items-center justify-between mb-2 sm:mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2">
              <span className="text-xs sm:text-sm text-blue-700 font-medium">Gesamteinsatz:</span>
              <span className="text-sm sm:text-base font-bold text-blue-700">{formatCurrency(match.bet_total_stake)}</span>
            </div>
          )}

          {/* Einsatz Input */}
          {canBet && (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Einsatz:</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="1000"
                  value={oddsInput}
                  onChange={(e) => setOddsInput(e.target.value)}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Einsatz"
                />
                <button
                  onClick={() => {
                    const stake = parseFloat(oddsInput)
                    if (stake >= 1 && stake <= 1000) {
                      handleSaveOdds(match.id, stake, match)
                    } else {
                      alert('Bitte einen Einsatz zwischen 1€ und 1000€ eingeben')
                    }
                  }}
                  disabled={savingMatchId === match.id}
                  className="px-8 sm:px-5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition font-semibold text-xs sm:text-sm whitespace-nowrap"
                >
                  {savingMatchId === match.id ? '...' : 'Speichern'}
                </button>
              </div>

              {effectiveOddsX && oddsInput && parseFloat(oddsInput) > 0 && (
                <div className="flex items-center justify-end mt-1">
                  <span className="text-[10px] sm:text-xs text-slate-500">
                    Gewinn: {formatCurrency(parseFloat(oddsInput) * effectiveOddsX)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Bereits getippt */}
          {isAlreadyBet && !hasMatchStarted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3">
              <span className="text-xs sm:text-sm text-green-800 font-semibold">✓ Getippt</span>
            </div>
          )}

          {/* Spiel gestartet */}
          {hasMatchStarted && !match.is_finished && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
              <div className="text-xs sm:text-sm text-red-800 font-semibold text-center">
                Spiel bereits gestartet - keine Tipps mehr möglich
              </div>
            </div>
          )}

          {/* Alternative Stake */}
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
                    <span className="text-xs sm:text-sm font-bold text-orange-700">{formatCurrency(calculatedAlternative)}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mb-2 sm:mb-3">
                    Berechnung: ({formatCurrency(match.total_stake)} × 3) ÷ {currentOdds.toFixed(2)}
                  </div>
                </>
              )}
              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                <button
                  onClick={() => handleAcceptAlternative(match.id)}
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

  // ─── Modal ────────────────────────────────────────────────────────────────────
  const Modal = () => {
    if (!showModal || !modalMatchId) return null
    const match = matches.find(m => m.id === modalMatchId)
    if (!match) return null

    const handleAbort = async (teamToAbort: 'home' | 'away') => {
      try {
        const { error } = await supabase.from('bets')
          .update({ [teamToAbort === 'home' ? 'home_team_abort' : 'away_team_abort']: true })
          .eq('match_id', modalMatchId)

        if (error) throw error

        setMatches(prev => prev.map(m => {
          if (m.id !== modalMatchId) return m
          return teamToAbort === 'home'
            ? { ...m, home_stake: 1, total_stake: 1 + m.away_stake }
            : { ...m, away_stake: 1, total_stake: m.home_stake + 1 }
        }))

        setAlternativeStakes(prev => { const nm = new Map(prev); nm.delete(modalMatchId); return nm })
        setShowModal(false)
        setModalMatchId(null)
        alert('Abbruch erfolgreich! Einsatz wird beim nächsten Spieltag auf 1€ zurückgesetzt.')
      } catch (e) {
        console.error('Fehler beim Abbruch:', e)
        alert('Fehler beim Abbruch des Teams')
      }
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">Einsatz anpassen</h3>
          <p className="text-xs sm:text-sm text-slate-600 mb-4 sm:mb-6">
            Wählen Sie eine Option für die Einsatzanpassung:
          </p>
          <div className="space-y-2 sm:space-y-3">
            {/* Heimteam */}
            <div className="border border-slate-200 rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-center mb-2 sm:mb-3">
                <span className="font-semibold text-sm sm:text-base text-slate-800">{match.home_team.short_name}</span>
                <span className="text-xs sm:text-sm text-slate-600">Aktuell: {formatCurrency(match.home_stake)}</span>
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
                <span className="text-xs sm:text-sm text-slate-600">Aktuell: {formatCurrency(match.away_stake)}</span>
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
            onClick={() => { setShowModal(false); setModalMatchId(null) }}
            className="w-full mt-3 sm:mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition font-medium text-xs sm:text-sm"
          >
            Abbrechen
          </button>
        </div>
      </div>
    )
  }

  // ─── Loading State ────────────────────────────────────────────────────────────
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

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:px-8">

        {/* Liga-Tabs */}
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-1">
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

        {/* Liga-Name + Spieltag-Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="hidden sm:block">
            <h2 className="text-xl font-bold text-slate-800">{leagueConfig.name}</h2>
          </div>

          <div className="flex items-end gap-2 flex-1 min-w-0 sm:ml-auto sm:flex-none">
            <button
              onClick={goToPreviousMatchday}
              disabled={isFirstMatchday}
              className={`p-2 sm:p-3 rounded-lg border transition flex-shrink-0 ${
                isFirstMatchday
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="flex-1 min-w-0 sm:w-48">
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
                  <option key={day} value={day}>{day}. Spieltag</option>
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
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
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
            {/* Statistiken */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-4 mb-4 sm:mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Gesamt</div>
                <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">{formatCurrency(stats.total)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Ø</div>
                <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">{formatCurrency(stats.avg)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Max</div>
                <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">{formatCurrency(stats.max)}</div>
              </div>
            </div>

            {/* Spiele */}
            {matches.length > 0 ? (
              <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matches.map(match => (
                  <BetCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
                <p className="text-slate-500 text-sm">Keine Spiele verfügbar</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal />
    </div>
  )
}