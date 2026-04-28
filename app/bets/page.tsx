'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

// ─── Liga-Konfiguration ────────────────────────────────────────────────────────
const LEAGUES = [
  { key: 'bl1',     label: '1. BL',    name: '1. Bundesliga',   oddsKey: 'soccer_germany_bundesliga',  season: '2025', color: 'blue',   flag: '🇩🇪' },
  { key: 'bl2',     label: '2. BL',    name: '2. Bundesliga',   oddsKey: 'soccer_germany_bundesliga2', season: '2025', color: 'slate',  flag: '🇩🇪' },
  { key: 'epl',     label: 'PL',       name: 'Premier League',  oddsKey: 'soccer_epl',                 season: '2025', color: 'purple', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { key: 'la_liga', label: 'LaLiga',  name: 'La Liga',         oddsKey: 'soccer_spain_la_liga',       season: '2025', color: 'red',    flag: '🇪🇸' },
  { key: 'serie_a', label: 'Ser A',  name: 'Serie A',         oddsKey: 'soccer_italy_serie_a',       season: '2025', color: 'green',  flag: '🇮🇹' },
  { key: 'ligue_1', label: 'Lig 1',  name: 'Ligue 1',         oddsKey: 'soccer_france_ligue_one',    season: '2025', color: 'indigo', flag: '🇫🇷' },
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
    table_position?: number | null
  }
  away_team: {
    id: number
    name: string
    short_name: string
    odds_api_id?: string
    table_position?: number | null
  }
  home_stake: number
  away_stake: number
  home_real_stake: number
  away_real_stake: number
  home_games_without_draw: number
  away_games_without_draw: number
  total_stake: number
  odds: number | null
  odds_x: number | null
  bet_total_stake: number | null
  bet_payout: number | null
  bet_result: string | null 
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

type ActiveTab = 'gesamt' | 'offen' | LeagueKey

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function BetsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('offen')
  const activeLeague = (activeTab !== 'gesamt' ? activeTab : 'bl1') as LeagueKey
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [availableMatchdays, setAvailableMatchdays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null)

  const [alternativeStakes, setAlternativeStakes] = useState<Map<number, AlternativeStake>>(new Map())
  const [showModal, setShowModal] = useState(false)
  const [modalMatchId, setModalMatchId] = useState<number | null>(null)
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set())

  const [apiOdds, setApiOdds] = useState<Map<number, ApiOdds>>(new Map())
  const [loadingApiOdds, setLoadingApiOdds] = useState(false)
  const [nextActualMatchday, setNextActualMatchday] = useState<number | null>(null)

  // ─── Gesamt-Tab State ─────────────────────────────────────────────────────────
  const [gesamtMatches, setGesamtMatches] = useState<Match[]>([])
  const [gesamtLoading, setGesamtLoading] = useState(true)

  // ─── Offen-Tab State ──────────────────────────────────────────────────────────
  const [offenMatches, setOffenMatches] = useState<Match[]>([])
  const [offenLoading, setOffenLoading] = useState(false)

  const leagueConfig = LEAGUES.find(l => l.key === activeLeague) ?? LEAGUES[0]

  // ─── Gesamt-Tab: Alle offenen Spiele mit gespeicherten Wetten laden ──────────
  useEffect(() => {
    if (activeTab !== 'gesamt') return

    async function fetchGesamtMatches() {
      setGesamtLoading(true)

      const { data: betsData } = await supabase
        .from('bets')
        .select('match_id, odds, total_stake, payout, result')

      if (!betsData?.length) {
        setGesamtMatches([])
        setGesamtLoading(false)
        return
      }

      const matchIds = betsData.map(b => b.match_id)
      const betsMap = new Map(betsData.map(b => [b.match_id, b]))

      const { data: matchData } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(id, name, short_name), away_team:teams!matches_away_team_id_fkey(id, name, short_name)`)
        .in('id', matchIds)
        .eq('is_finished', false)
        .order('match_date', { ascending: true })

      const enriched: Match[] = (matchData || []).map(match => {
        const bet = betsMap.get(match.id)
        return {
          ...match,
          home_stake: 0,
          away_stake: 0,
          home_real_stake: 0,
          away_real_stake: 0,
          home_games_without_draw: 0,
          away_games_without_draw: 0,
          total_stake: bet?.total_stake || 0,
          odds: bet?.odds || null,
          bet_total_stake: bet?.total_stake || null,
          bet_payout: bet?.payout || null,
          bet_result: bet?.result || null,
        }
      })

      setGesamtMatches(enriched)
      setGesamtLoading(false)
    }

    fetchGesamtMatches()
  }, [activeTab])

  // ─── Offen-Tab: Spiele laden mit Tipico-Quoten und games_without_draw ─────────
  useEffect(() => {
    if (activeTab !== 'offen') return

    async function fetchOffenMatches() {
      setOffenLoading(true)

      const now = new Date().toISOString()

      // Alle zukünftigen unbeendeten Spiele laden
      const { data: allUpcoming } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(id, name, short_name, odds_api_id, table_position), away_team:teams!matches_away_team_id_fkey(id, name, short_name, odds_api_id, table_position)`)
        .eq('is_finished', false)
        .gt('match_date', now)
        .order('match_date', { ascending: true })

      if (!allUpcoming?.length) {
        setOffenMatches([])
        setOffenLoading(false)
        return
      }

      // Nächsten Spieltag pro Liga bestimmen
      const nextMatchdayPerLeague = new Map<string, number>()
      LEAGUES.forEach(league => {
        const first = allUpcoming.find(m => m.league_shortcut === league.key)
        if (first) nextMatchdayPerLeague.set(league.key, first.matchday)
      })

      // Nur den nächsten Spieltag je Liga betrachten
      const relevantMatches = allUpcoming.filter(m => {
        const nextMd = nextMatchdayPerLeague.get(m.league_shortcut)
        return nextMd !== undefined && m.matchday === nextMd
      })

      // Bereits gesetzte Wetten ausschließen
      const matchIds = relevantMatches.map(m => m.id)
      const { data: betsData } = await supabase
        .from('bets').select('match_id, odds').in('match_id', matchIds).not('odds', 'is', null)
      const bettedMatchIds = new Set(betsData?.map(b => b.match_id) || [])
      const unbetted = relevantMatches.filter(m => !bettedMatchIds.has(m.id))

      // Team-Einsätze laden
      const teamIds = [...new Set([...unbetted.map(m => m.home_team_id), ...unbetted.map(m => m.away_team_id)])]
      const { data: allStakes } = await supabase
        .from('team_stakes').select('team_id, stake, real_stake, matchday, season').in('team_id', teamIds)
      const stakesMap = new Map(allStakes?.map(s => [`${s.team_id}-${s.matchday}-${s.season}`, { stake: s.stake, real_stake: s.real_stake || 0 }]) || [])

      // Historische Spieltage je Liga für games_without_draw laden
      const leaguesPresent = [...new Set(unbetted.map(m => m.league_shortcut))]
      const historicalByLeague = new Map<string, any[]>()
      await Promise.all(leaguesPresent.map(async leagueKey => {
        const season = LEAGUES.find(l => l.key === leagueKey)?.season ?? '2025'
        const { data } = await supabase.from('matches').select('*').eq('league_shortcut', leagueKey).eq('season', season).order('matchday', { ascending: true })
        if (data) historicalByLeague.set(leagueKey, data)
      }))

      const calcGamesWithoutDraw = (teamId: number, leagueKey: string): number => {
        const all = historicalByLeague.get(leagueKey) || []
        const maxMd = all.filter(m => m.is_finished).reduce((max, m) => Math.max(max, m.matchday), 0)
        let count = 0
        for (let md = maxMd; md >= 1; md--) {
          const m = all.find(x => x.matchday === md && x.is_finished && (x.home_team_id === teamId || x.away_team_id === teamId))
          if (!m) continue
          if (m.result === 'x') break
          count++
        }
        return count
      }

      // Matches anreichern (inkl. Spiele ohne Einsatz für "Neue Teams"-Sektion)
      const enriched: Match[] = unbetted.map(match => {
        const leagueSeason = LEAGUES.find(l => l.key === match.league_shortcut)?.season ?? '2025'
        const homeStakeData = stakesMap.get(`${match.home_team_id}-${match.matchday}-${leagueSeason}`) || { stake: 0, real_stake: 0 }
        const awayStakeData = stakesMap.get(`${match.away_team_id}-${match.matchday}-${leagueSeason}`) || { stake: 0, real_stake: 0 }
        return {
          ...match,
          home_stake: homeStakeData.stake,
          away_stake: awayStakeData.stake,
          home_real_stake: homeStakeData.real_stake,
          away_real_stake: awayStakeData.real_stake,
          home_games_without_draw: calcGamesWithoutDraw(match.home_team_id, match.league_shortcut),
          away_games_without_draw: calcGamesWithoutDraw(match.away_team_id, match.league_shortcut),
          total_stake: homeStakeData.stake + awayStakeData.stake,
          odds: null,
          odds_x: null,
          bet_total_stake: null,
          bet_payout: null,
          bet_result: null,
        }
      })

      setOffenMatches(enriched)
      setOffenLoading(false)

      // Keine offenen Spiele → automatisch zum Gesamt-Tab wechseln
      const hasOffen = enriched.some(m => m.home_real_stake > 0 || m.away_real_stake > 0 || m.home_stake > 0 || m.away_stake > 0)
      if (!hasOffen) {
        setActiveTab('gesamt')
        return
      }

      // Tipico-Quoten je Liga nachladen
      leaguesPresent.forEach(leagueKey => {
        const leagueConf = LEAGUES.find(l => l.key === leagueKey)
        if (!leagueConf) return
        const leagueMatches = enriched.filter(m => m.league_shortcut === leagueKey && (m.home_stake > 0 || m.away_stake > 0))
        if (leagueMatches.length > 0) fetchOddsFromAPI(leagueMatches, leagueConf.oddsKey)
      })
    }

    fetchOffenMatches()
  }, [activeTab])

  // ─── Beim Liga-Wechsel: Matchdays neu laden ──────────────────────────────────
  useEffect(() => {
    if (activeTab === 'gesamt' || activeTab === 'offen') return

    setSelectedMatchday(null)
    setMatches([])
    setApiOdds(new Map())
    setNextActualMatchday(null)
    setExpandedMatches(new Set())

    async function fetchMatchdays() {
      const { data } = await supabase
        .from('matches')
        .select('matchday, match_date, is_finished')
        .eq('league_shortcut', activeLeague)
        .order('match_date', { ascending: true })

      if (data) {
        const uniqueMatchdays = [...new Set(data.map(m => m.matchday))].sort((a, b) => a - b)
        setAvailableMatchdays(uniqueMatchdays)

        const now = new Date()

        // Nächstes Spiel nach Datum finden → dessen Spieltag wählen
        const nextMatch = data
          .filter(m => !m.is_finished && new Date(m.match_date) >= now)
          .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())[0]

        if (nextMatch) {
          setSelectedMatchday(nextMatch.matchday)
        } else {
          setSelectedMatchday(uniqueMatchdays[uniqueMatchdays.length - 1] ?? null)
        }
      }
    }
    fetchMatchdays()
  }, [activeTab, activeLeague])

  // ─── Spiele & Stakes laden ────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedMatchday === null || activeTab === 'gesamt' || activeTab === 'offen') return

    async function fetchMatchesWithStakes() {
      setLoading(true)

      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name, odds_api_id, table_position),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name, odds_api_id, table_position)
        `)
        .eq('matchday', selectedMatchday)
        .eq('league_shortcut', activeLeague)
        .order('match_date', { ascending: true })

      // Lade ALLE Matches der Liga für games_without_draw Berechnung
      const { data: allMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('league_shortcut', activeLeague)
        .eq('season', leagueConfig.season)
        .order('matchday', { ascending: true })

      const { data: stakes } = await supabase
        .from('team_stakes')
        .select('team_id, stake, real_stake')
        .eq('matchday', selectedMatchday)
        .eq('season', leagueConfig.season)

      const matchIds = matchData?.map(m => m.id) || []

      const { data: bets } = await supabase
        .from('bets')
        .select('match_id, odds, total_stake, payout, result')
        .in('match_id', matchIds)

      const stakesMap = new Map(stakes?.map(s => [s.team_id, { 
        stake: s.stake, 
        real_stake: s.real_stake || 0
      }]) || [])
      const betsMap = new Map(bets?.map(b => [b.match_id, { odds: b.odds, total_stake: b.total_stake, payout: b.payout, result: b.result,}]) || [])

      // Finde höchsten gespielten Spieltag
      const maxPlayedMatchday = allMatches
        ?.filter(m => m.is_finished)
        .reduce((max, m) => Math.max(max, m.matchday), 0) || 0

      // Berechne games_without_draw für jedes Team (wie auf Statistikseite)
      const calculateGamesWithoutDraw = (teamId: number): number => {
        let count = 0
        // Gehe rückwärts vom höchsten gespielten Spieltag
        for (let md = maxPlayedMatchday; md >= 1; md--) {
          const match = allMatches?.find(m =>
            m.matchday === md &&
            m.is_finished === true &&
            (m.home_team_id === teamId || m.away_team_id === teamId)
          )
          if (!match) continue
          if (match.result === 'x') break  // Stoppe bei Unentschieden
          count++
        }
        return count
      }

      const enriched: Match[] = (matchData || []).map(match => {
        const betData = betsMap.get(match.id)
        const homeStakeData = stakesMap.get(match.home_team_id) || { stake: 0, real_stake: 0 }
        const awayStakeData = stakesMap.get(match.away_team_id) || { stake: 0, real_stake: 0 }
        
        return {
          ...match,
          home_stake: homeStakeData.stake,
          away_stake: awayStakeData.stake,
          home_real_stake: homeStakeData.real_stake,
          away_real_stake: awayStakeData.real_stake,
          home_games_without_draw: calculateGamesWithoutDraw(match.home_team_id),
          away_games_without_draw: calculateGamesWithoutDraw(match.away_team_id),
          total_stake: homeStakeData.stake + awayStakeData.stake,
          odds: betData?.odds || null,
          bet_total_stake: betData?.total_stake || null,
		  bet_payout: betData?.payout || null,
		  bet_result: betData?.result || null,
        }
      })

      setMatches(enriched)

      setLoading(false)
    }

    fetchMatchesWithStakes()
  }, [selectedMatchday, activeTab, activeLeague])

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
  const handleSaveOdds = async (matchId: number, quote: number, match: Match, homeStake?: number, awayStake?: number) => {
    setSavingMatchId(matchId)
    try {
      let finalHomeStake = homeStake ?? 0
      let finalAwayStake = awayStake ?? 0
      const totalStake = finalHomeStake + finalAwayStake

      // Matchday & Season aus dem Match-Objekt ableiten (funktioniert in allen Tabs)
      const matchday = match.matchday ?? selectedMatchday
      const season = LEAGUES.find(l => l.key === match.league_shortcut)?.season ?? leagueConfig.season
      
      const { error } = await supabase.from('bets').upsert({
        match_id: matchId,
        matchday,
        season,
        odds: quote,
        home_stake: finalHomeStake,
        away_stake: finalAwayStake,
        total_stake: totalStake,
      }, { onConflict: 'match_id' })

      if (error) throw error

      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, odds: quote, bet_total_stake: totalStake } : m))
      // Im Offen-Tab: gespeichertes Spiel aus der Liste entfernen
      setOffenMatches(prev => prev.filter(m => m.id !== matchId))

      if (finalHomeStake > 250 || finalAwayStake > 250) {
        const alternative = calculateAlternativeStake(totalStake, quote)
        setAlternativeStakes(prev => new Map(prev).set(matchId, {
          matchId, alternativeAmount: alternative, originalStake: totalStake, quote: quote,
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
    const match = matches.find(m => m.id === matchId) ?? offenMatches.find(m => m.id === matchId)
    if (!match) return

    const teamId = teamToReduce === 'home' ? match.home_team_id : match.away_team_id
    const otherTeamStake = teamToReduce === 'home' ? match.away_stake : match.home_stake
    const newStake = alternative.alternativeAmount - otherTeamStake

    if (newStake < 0) { alert('Fehler: Berechneter Einsatz ist negativ!'); return }

    const matchSeason = LEAGUES.find(l => l.key === match.league_shortcut)?.season ?? leagueConfig.season

    try {
      const { error } = await supabase.from('team_stakes')
        .update({ stake: newStake })
        .eq('team_id', teamId)
        .eq('matchday', match.matchday)
        .eq('season', matchSeason)

      if (error) throw error

      const updater = (m: Match) => {
        if (m.id !== matchId) return m
        return teamToReduce === 'home'
          ? { ...m, home_stake: newStake, total_stake: newStake + m.away_stake }
          : { ...m, away_stake: newStake, total_stake: m.home_stake + newStake }
      }
      setMatches(prev => prev.map(updater))
      setOffenMatches(prev => prev.map(updater))

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
    possibleWin: matches
      .filter(m => m.bet_total_stake && m.odds && !m.is_finished)
      .reduce((s, m) => s + (m.bet_total_stake! * m.odds!), 0),
    max: matches.length > 0 ? Math.max(...matches.map(m => m.total_stake)) : 0,
  }

  // ─── BetCard ──────────────────────────────────────────────────────────────────
  const BetCard = ({ match, showLeagueFlag = false }: { match: Match; showLeagueFlag?: boolean }) => {
    const matchApiOdds = apiOdds.get(match.id)
    const effectiveOddsX = match.odds_x ?? matchApiOdds?.draw ?? null

    const [oddsInput, setOddsInput] = useState<string>(effectiveOddsX?.toString() || '')
    const [homeStakeInput, setHomeStakeInput] = useState<string>(
      match.home_real_stake > 0 ? match.home_real_stake.toString() : (match.home_stake > 0 ? match.home_stake.toString() : '')
    )
    const [awayStakeInput, setAwayStakeInput] = useState<string>(
      match.away_real_stake > 0 ? match.away_real_stake.toString() : (match.away_stake > 0 ? match.away_stake.toString() : '')
    )

    // Bestimme welche Teams Einsatz haben
    const homeHasStake = match.home_stake > 0 || match.home_real_stake > 0
    const awayHasStake = match.away_stake > 0 || match.away_real_stake > 0
    const bothTeamsHaveStake = homeHasStake && awayHasStake
    const onlyHomeHasStake = homeHasStake && !awayHasStake
    const onlyAwayHasStake = awayHasStake && !homeHasStake

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
    const bothTeamsZeroStake = match.home_stake === 0 && match.away_stake === 0
    const isExpanded = expandedMatches.has(match.id)
    const canCollapse = bothTeamsZeroStake && !match.is_finished
    const shouldShowCollapsed = canCollapse && !isExpanded

    const currentOdds = parseFloat(oddsInput) || 3.40
    const calculatedAlternative = anyTeamOver250 && effectiveOddsX ? calculateAlternativeStake(match.total_stake, effectiveOddsX) : null

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
      <div ref={cardRef} className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition ${
        shouldShowCollapsed 
          ? 'opacity-50 border-slate-100 bg-slate-50' 
          : 'border-slate-200'
      }`}>
        {shouldShowCollapsed ? (
          // Eingeklappte Ansicht - Klick zum Ausklappen
          <div 
            className="p-2 sm:p-3 cursor-pointer hover:opacity-70"
            onClick={() => setExpandedMatches(prev => new Set(prev).add(match.id))}
          >
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
              <span className="text-slate-500">{formatDate(match.match_date)}</span>
              <span>
                <span className="font-medium">{match.home_team.short_name}</span>
                {' vs '}
                <span className="font-medium">{match.away_team.short_name}</span>
              </span>
            </div>
          </div>
        ) : (
          // Normale Ansicht
          <div className="p-3 sm:p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 sm:mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                {showLeagueFlag && (() => {
                  const lInfo = LEAGUES.find(l => l.key === match.league_shortcut)
                  return lInfo ? (
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 border"
                      style={{ background: COUNTRY_COLORS[lInfo.key].active, borderColor: COUNTRY_COLORS[lInfo.key].border }}
                    />
                  ) : null
                })()}
                {match.is_finished ? (
                  <>{formatDate(match.match_date)}</>
                ) : hasMatchStarted ? (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold">Läuft</span>
                ) : (
                  <span>{formatDate(match.match_date)}</span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-600">
                {match.is_finished ? (
                  <span className="px-2 py-1 bg-slate-100 rounded-full">Beendet</span>
                ) : canCollapse && isExpanded ? (
                  <button
                    onClick={() => {
                      setExpandedMatches(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(match.id)
                        return newSet
                      })
                    }}
                    className="text-slate-400 hover:text-slate-600 transition"
                  >
                    Einklappen ↑
                  </button>
                ) : null}
              </div>
            </div>

          {/* Teams */}
          <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm sm:text-base font-semibold ${homeTeamOver250 ? 'text-orange-600' : 'text-slate-800'}`}>
                  {match.home_team.short_name}
                </span>
                {(hasMatchStarted || match.is_finished) && match.home_goals !== null && (
                  <span className="text-lg sm:text-xl font-bold text-slate-700 ml-1">{match.home_goals}</span>
                )}
                {match.home_team.table_position && (
                  <span className="text-xs text-slate-400">{match.home_team.table_position}.</span>
                )}
                {!match.is_finished && match.home_games_without_draw > 0 && (
                  <span className="text-[10px] sm:text-xs text-slate-400">- {match.home_games_without_draw} Spiele ohne x</span>
                )}
              </div>
              <span className={`text-xs sm:text-sm font-bold ${homeTeamOver250 ? 'text-orange-600' : 'text-slate-600'}`}>
                {match.home_real_stake > 0 && match.home_stake > 1 ? (
                  <>
                    <span className="text-[10px] sm:text-xs text-slate-500">({formatCurrency(match.home_real_stake)}) </span>
                    {formatCurrency(match.home_stake)}
                  </>
                ) : (
                  formatCurrency(match.home_stake)
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm sm:text-base font-semibold ${awayTeamOver250 ? 'text-orange-600' : 'text-slate-800'}`}>
                  {match.away_team.short_name}
                </span>
                {(hasMatchStarted || match.is_finished) && match.away_goals !== null && (
                  <span className="text-lg sm:text-xl font-bold text-slate-700 ml-1">{match.away_goals}</span>
                )}
                {match.away_team.table_position && (
                  <span className="text-xs text-slate-400">{match.away_team.table_position}.</span>
                )}
                {!match.is_finished && match.away_games_without_draw > 0 && (
                  <span className="text-[10px] sm:text-xs text-slate-400">- {match.away_games_without_draw} Spiele ohne x</span>
                )}
              </div>
              <span className={`text-xs sm:text-sm font-bold ${awayTeamOver250 ? 'text-orange-600' : 'text-slate-600'}`}>
                {match.away_real_stake > 0 && match.away_stake > 1 ? (
                  <>
                    <span className="text-[10px] sm:text-xs text-slate-500">({formatCurrency(match.away_real_stake)}) </span>
                    {formatCurrency(match.away_stake)}
                  </>
                ) : (
                  formatCurrency(match.away_stake)
                )}
              </span>
            </div>
          </div>

          {/* Tipico Quote */}
          {effectiveOddsX ? (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm text-slate-600">Tipico Quote (X):</span>
              <span className="text-sm sm:text-base font-bold text-slate-600">{effectiveOddsX.toFixed(2)}</span>
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
		  
		{/* Gewinn anzeigen wenn Unentschieden */}
{match.is_finished && match.bet_result === 'x' && match.bet_payout != null && match.bet_payout > 0 && (
  <div className="flex items-center justify-between mb-2 sm:mb-3 bg-green-50 border border-green-200 rounded-lg p-2">
    <span className="text-xs sm:text-sm text-green-700 font-medium">Gewinn:</span>
    <span className="text-sm sm:text-base font-bold text-green-700">{formatCurrency(match.bet_payout)}</span>
  </div>
)}

          {/* Einsatz Input - dynamisch 1 oder 2 Felder */}
          {canBet && (
            <>
              {bothTeamsHaveStake ? (
                /* Beide Teams haben Einsatz - 2 Zeilen */
                <div className="space-y-2">
                  {/* Zeile 1: Heim und Gast nebeneinander */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Heim:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="1000"
                        value={homeStakeInput}
                        onChange={(e) => setHomeStakeInput(e.target.value)}
                        className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder={match.home_real_stake > 0 ? match.home_real_stake.toString() : (match.home_stake > 0 ? match.home_stake.toString() : '0')}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Gast:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="1000"
                        value={awayStakeInput}
                        onChange={(e) => setAwayStakeInput(e.target.value)}
                        className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder={match.away_real_stake > 0 ? match.away_real_stake.toString() : (match.away_stake > 0 ? match.away_stake.toString() : '0')}
                      />
                    </div>
                  </div>
                  {/* Zeile 2: Einsatz (SUMME!) readonly + Speichern */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Einsatz:</span>
                    <input
                      type="number"
                      value={((parseFloat(homeStakeInput) || 0) + (parseFloat(awayStakeInput) || 0)).toString()}
                      readOnly
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50"
                    />
                    <button
                      onClick={() => {
  const homeStake = parseFloat(homeStakeInput) || 0
  const awayStake = parseFloat(awayStakeInput) || 0

  if (!effectiveOddsX) {
    alert('Bitte zuerst eine Quote eingeben')
    return
  }
  if (homeStake === 0 && awayStake === 0) {
    alert('Bitte gültigen Einsatz eingeben')
    return
  }

  handleSaveOdds(match.id, effectiveOddsX, match, homeStake, awayStake)
}}
                      disabled={savingMatchId === match.id}
                      className="px-3 sm:px-5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition font-semibold text-xs sm:text-sm whitespace-nowrap"
                    >
                      {savingMatchId === match.id ? '...' : 'Speichern'}
                    </button>
                  </div>
                  {/* Zeile 3: Angezeigter Gesamteinsatz + Gewinn beider Teams */}
                  <div className="text-xs text-slate-500 text-right space-y-0.5">
                    <div>Gesamteinsatz: {formatCurrency((parseFloat(homeStakeInput) || 0) + (parseFloat(awayStakeInput) || 0))}</div>
                    {effectiveOddsX && effectiveOddsX > 0 && (
                      <div>Gewinn: {formatCurrency(((parseFloat(homeStakeInput) || 0) + (parseFloat(awayStakeInput) || 0)) * effectiveOddsX )}</div>
                    )}
                  </div>
                </div>
              ) : onlyHomeHasStake ? (
                /* Nur Heim-Team hat Einsatz - Nur Team-Einsatz + Speichern */
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Einsatz {match.home_team.short_name}:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="1000"
                    value={homeStakeInput}
                    onChange={(e) => setHomeStakeInput(e.target.value)}
                    className="w-20 px-2 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={match.home_real_stake > 0 ? match.home_real_stake.toString() : match.home_stake.toString()}
                  />
                  <button
                    onClick={() => {
                      const homeStake = parseFloat(homeStakeInput) || 0
                      if (effectiveOddsX && homeStake > 0) {
                        handleSaveOdds(match.id, effectiveOddsX, match, homeStake, 0)
                      } else {
                        alert('Bitte gültigen Einsatz eingeben')
                      }
                    }}
                    disabled={savingMatchId === match.id}
                    className="px-3 sm:px-5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition font-semibold text-xs sm:text-sm whitespace-nowrap"
                  >
                    {savingMatchId === match.id ? '...' : 'Speichern'}
                  </button>
                </div>
              ) : onlyAwayHasStake ? (
                /* Nur Gast-Team hat Einsatz - Nur Team-Einsatz + Speichern */
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Einsatz {match.away_team.short_name}:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="1000"
                    value={awayStakeInput}
                    onChange={(e) => setAwayStakeInput(e.target.value)}
                    className="w-20 px-2 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={match.away_real_stake > 0 ? match.away_real_stake.toString() : match.away_stake.toString()}
                  />
                  <button
                    onClick={() => {
                      const awayStake = parseFloat(awayStakeInput) || 0
                      if (effectiveOddsX && awayStake > 0) {
                        handleSaveOdds(match.id, effectiveOddsX, match, 0, awayStake)
                      } else {
                        alert('Bitte gültigen Einsatz eingeben')
                      }
                    }}
                    disabled={savingMatchId === match.id}
                    className="px-3 sm:px-5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition font-semibold text-xs sm:text-sm whitespace-nowrap"
                  >
                    {savingMatchId === match.id ? '...' : 'Speichern'}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Bereits getippt */}
          {isAlreadyBet && !hasMatchStarted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 flex items-center justify-between">
				<span className="text-xs sm:text-sm text-green-800 font-semibold">✓ Getippt</span>
				 {match.bet_total_stake && match.odds && (
				<span className="text-xs sm:text-sm text-green-800 font-bold">
				 mögl. Gewinn: {formatCurrency(match.bet_total_stake * match.odds)}
				</span>
				)}
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
                    Berechnung: ({formatCurrency(match.total_stake)} × 3) ÷ {effectiveOddsX?.toFixed(2) ?? '–'}
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
        )}
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

  // ─── Loading State (nur Liga-Tabs) ──────────────────────────────────────────
  if (activeTab !== 'gesamt' && activeTab !== 'offen' && selectedMatchday === null) {
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

        {/* Tabs: Gesamt + Offen + Ligen – sticky beim Scrollen */}
        <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm -mx-3 sm:-mx-4 lg:-mx-8 px-3 sm:px-4 lg:px-8 pt-2 pb-2 mb-4 sm:mb-6 border-b border-slate-200/60 shadow-sm">
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-0.5">
          {/* Gesamt-Tab */}
          <button
            onClick={() => setActiveTab('gesamt')}
            className={`px-2 sm:px-4 py-2 rounded-lg font-semibold text-[10px] sm:text-sm transition whitespace-nowrap border flex-shrink-0 ${
              activeTab === 'gesamt'
                ? 'bg-slate-800 text-white border-slate-800 shadow'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Gesamt
          </button>

          {/* Offen-Tab */}
          <button
            onClick={() => setActiveTab('offen')}
            className={`px-2 sm:px-4 py-2 rounded-lg font-semibold text-[10px] sm:text-sm transition whitespace-nowrap border flex-shrink-0 ${
              activeTab === 'offen'
                ? 'bg-amber-500 text-white border-amber-500 shadow'
                : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
            }`}
          >
            Offen{(() => { const n = offenMatches.filter(m => m.home_real_stake > 0 || m.away_real_stake > 0).length; return n > 0 && activeTab !== 'offen' ? ` (${n})` : '' })()}
          </button>
          {LEAGUES.map(league => {
            const isActive = activeTab === league.key
            const colors = COUNTRY_COLORS[league.key]
            return (
              <button
                key={league.key}
                onClick={() => setActiveTab(league.key)}
                style={{
                  background: isActive ? colors.active : colors.inactive,
                  borderColor: isActive ? colors.border : '#d1d5db',
                  boxShadow: isActive ? `0 0 0 1px ${colors.border}` : undefined,
                }}
                className="px-1 sm:px-4 py-2 rounded-lg font-semibold text-[10px] sm:text-sm transition whitespace-nowrap border text-slate-800 hover:opacity-90 flex-shrink-0"
              >
                {league.label}
              </button>
            )
          })}
          </div>
        </div>

        {/* ── Offen-Tab Inhalt ── */}
        {activeTab === 'offen' ? (
          offenLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
              <p className="mt-2 text-slate-600 text-sm">Lade offene Wetten...</p>
            </div>
          ) : (() => {
            const mitEinsatz = offenMatches.filter(m => m.home_real_stake > 0 || m.away_real_stake > 0)
            const neueTeams = offenMatches.filter(m => (m.home_stake > 0 || m.away_stake > 0) && m.home_real_stake === 0 && m.away_real_stake === 0)
            if (mitEinsatz.length === 0 && neueTeams.length === 0) {
              return (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
                  <p className="text-slate-500 text-sm">Keine offenen Wetten – alle Einsätze sind bereits gesetzt.</p>
                </div>
              )
            }
            return (
              <>
                {/* Sektion 1: Spiele mit Einsatz (bereits im System) */}
                {mitEinsatz.length > 0 && (
                  <>
                    <div className="text-xs sm:text-sm text-slate-500 mb-3">
                      {mitEinsatz.length} {mitEinsatz.length === 1 ? 'Spiel' : 'Spiele'} – Einsatz wird verdoppelt
                    </div>
                    <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                      {mitEinsatz.map(match => (
                        <BetCard key={match.id} match={match} showLeagueFlag={true} />
                      ))}
                    </div>
                  </>
                )}

                {/* Sektion 2: Neue Teams */}
                {neueTeams.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 my-4 sm:my-6">
                      <div className="flex-1 h-px bg-slate-300" />
                      <span className="text-sm sm:text-base font-bold text-slate-600 whitespace-nowrap">Neue Teams:</span>
                      <div className="flex-1 h-px bg-slate-300" />
                    </div>
                    <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {neueTeams.map(match => (
                        <BetCard key={match.id} match={match} showLeagueFlag={true} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )
          })()
        ) : activeTab === 'gesamt' ? (
        /* ── Gesamt-Tab Inhalt ── */
          gesamtLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
              <p className="mt-2 text-slate-600 text-sm">Lade Wetten...</p>
            </div>
          ) : gesamtMatches.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
              <p className="text-slate-500 text-sm">Keine gespeicherten Wetten</p>
            </div>
          ) : (
            <>
              {/* Gesamt-Statistiken */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                  <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Einsatz gesamt</div>
                  <div className="text-sm sm:text-base md:text-2xl font-bold text-slate-800">
                    {formatCurrency(gesamtMatches.reduce((s, m) => s + (m.bet_total_stake || 0), 0))}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-3 md:p-5">
                  <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Möglicher Gewinn</div>
                  <div className="text-sm sm:text-base md:text-2xl font-bold text-green-700">
                    {formatCurrency(gesamtMatches
                      .filter(m => m.bet_total_stake && m.odds)
                      .reduce((s, m) => s + (m.bet_total_stake! * m.odds!), 0))}
                  </div>
                </div>
              </div>

              {/* Kompakte Spiel-Liste */}
              <div className="space-y-2">
			  <div className="text-xs sm:text-sm text-slate-500 mb-2">
  {gesamtMatches.length} {gesamtMatches.length === 1 ? 'Wette' : 'Wetten'} gespeichert
</div>
                {gesamtMatches.map(match => {
                  const leagueInfo = LEAGUES.find(l => l.key === match.league_shortcut)
                  const possibleWin = match.bet_total_stake && match.odds ? match.bet_total_stake * match.odds : null
                  return (
                    <div key={match.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
						{leagueInfo && (
  <div
    className="w-8 h-8 rounded flex-shrink-0 border"
    style={{
      background: COUNTRY_COLORS[leagueInfo.key].active,
      borderColor: COUNTRY_COLORS[leagueInfo.key].border,
    }}
  />
)}
                          <div className="min-w-0">
                            <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5">
                              {formatDate(match.match_date)} · {leagueInfo?.name} · Spieltag {match.matchday}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                              {match.home_team.short_name} vs {match.away_team.short_name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 space-y-0.5">
                          <div className="text-xs text-slate-500">
                            Einsatz: <span className="font-semibold text-slate-700">{formatCurrency(match.bet_total_stake || 0)}</span>
                          </div>
                          {match.odds && (
                            <div className="text-xs text-slate-500">
                              Quote: <span className="font-semibold text-slate-700">{match.odds.toFixed(2)}</span>
                            </div>
                          )}
                          {possibleWin && (
                            <div className="text-xs font-bold text-green-700">
                              Gewinn: {formatCurrency(possibleWin)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        ) : (
          /* ── Liga-Tab Inhalt ── */
          <>
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
                    value={selectedMatchday ?? ''}
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
                    <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Mög. Gewinn</div>
                    <div className="text-sm sm:text-base md:text-2xl font-bold text-green-700">{formatCurrency(stats.possibleWin)}</div>
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
          </>
        )}
      </div>

      <Modal />
    </div>
  )
}