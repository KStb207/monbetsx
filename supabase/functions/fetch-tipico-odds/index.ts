// Supabase Edge Function: fetch-tipico-odds
// Pfad: supabase/functions/fetch-tipico-odds/index.ts
// Beschreibung: Holt Tipico X-Quoten von The Odds API und speichert sie in der DB

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OddsAPIGame {
  id: string
  home_team: string
  away_team: string
  bookmakers: Array<{
    key: string
    markets: Array<{
      key: string
      outcomes: Array<{
        name: string
        price: number
      }>
    }>
  }>
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Supabase Client erstellen
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // The Odds API Key
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')!
    
    console.log('🚀 Starte Odds-Abruf...')
    
    let totalUpdated = 0
    let totalErrors = 0

    // Beide Ligen durchgehen
    const leagues = [
      { key: 'soccer_germany_bundesliga', shortcut: 'bl1', name: '1. Bundesliga' },
      { key: 'soccer_germany_bundesliga2', shortcut: 'bl2', name: '2. Bundesliga' }
    ]

    for (const league of leagues) {
      console.log(`\n📊 Verarbeite ${league.name}...`)
      
      // 1. API-Daten holen
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h&oddsFormat=decimal&bookmakers=tipico_de`
      
      const apiResponse = await fetch(apiUrl)
      if (!apiResponse.ok) {
        console.error(`❌ API Error für ${league.name}: ${apiResponse.status}`)
        totalErrors++
        continue
      }

      const apiData: OddsAPIGame[] = await apiResponse.json()
      console.log(`   ✅ ${apiData.length} Spiele von API erhalten`)

      // 2. Matches aus DB holen (nächste 2 Spieltage)
      const { data: matchdayData } = await supabase
  .from('matches')
  .select('matchday')
  .eq('league_shortcut', league.shortcut)
  .eq('is_finished', false)
  .order('match_date', { ascending: true })
  .limit(1)

const currentMatchday = matchdayData?.[0]?.matchday

if (!currentMatchday) {
  console.log(`   ⚠️ Kein offener Spieltag gefunden`)
  continue
}

console.log(`   📅 Aktueller Spieltag: ${currentMatchday}`)

const { data: matches, error: matchesError } = await supabase
  .from('matches')
  .select(`
    id,
    matchday,
    home_team:teams!matches_home_team_id_fkey(id, name, short_name, odds_api_id),
    away_team:teams!matches_away_team_id_fkey(id, name, short_name, odds_api_id)
  `)
  .eq('league_shortcut', league.shortcut)
  .eq('matchday', currentMatchday) // <- NEU: Nur aktueller Spieltag!
  .order('match_date', { ascending: true })

      if (matchesError) {
        console.error(`❌ DB Error für ${league.name}:`, matchesError)
        totalErrors++
        continue
      }

      console.log(`   📋 ${matches?.length || 0} Matches aus DB geladen`)

      // 3. Matching und Update
      let leagueUpdated = 0
      
      for (const match of matches || []) {
        // Finde passendes API-Spiel
        const apiGame = apiData.find((game) => {
          const homeMatch = 
            (match.home_team.odds_api_id && game.home_team.trim() === match.home_team.odds_api_id.trim()) ||
            game.home_team.trim() === match.home_team.name?.trim() ||
            game.home_team.trim() === match.home_team.short_name?.trim()

          const awayMatch =
            (match.away_team.odds_api_id && game.away_team.trim() === match.away_team.odds_api_id.trim()) ||
            game.away_team.trim() === match.away_team.name?.trim() ||
            game.away_team.trim() === match.away_team.short_name?.trim()

          return homeMatch && awayMatch
        })

        if (!apiGame) {
          console.log(`   ⚠️ Kein Match: ${match.home_team.short_name} vs ${match.away_team.short_name}`)
          continue
        }

        // Finde Tipico Bookmaker
        const tipico = apiGame.bookmakers.find(b => b.key === 'tipico_de')
        if (!tipico) {
          console.log(`   ⚠️ Kein Tipico: ${match.home_team.short_name} vs ${match.away_team.short_name}`)
          continue
        }

        // Finde X-Quote
        const h2hMarket = tipico.markets.find(m => m.key === 'h2h')
        const drawOdds = h2hMarket?.outcomes.find(o => o.name === 'Draw')?.price

        if (!drawOdds) {
          console.log(`   ⚠️ Keine X-Quote: ${match.home_team.short_name} vs ${match.away_team.short_name}`)
          continue
        }

        // Update in DB
        const { error: updateError } = await supabase
          .from('matches')
          .update({ odds_x: drawOdds })
          .eq('id', match.id)

        if (updateError) {
          console.error(`   ❌ Update Error für Match ${match.id}:`, updateError)
          totalErrors++
        } else {
          console.log(`   ✅ ${match.home_team.short_name} vs ${match.away_team.short_name}: X = ${drawOdds}`)
          leagueUpdated++
          totalUpdated++
        }
      }

      console.log(`   📊 ${league.name}: ${leagueUpdated} von ${matches?.length || 0} Matches aktualisiert`)
    }

    console.log(`\n✅ Gesamt: ${totalUpdated} Matches aktualisiert, ${totalErrors} Fehler`)

    return new Response(
      JSON.stringify({
        success: true,
        totalUpdated,
        totalErrors,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Kritischer Fehler:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})