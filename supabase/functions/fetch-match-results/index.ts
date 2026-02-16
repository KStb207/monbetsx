import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    console.log('🚀 Starte Ergebnis-Abruf...')

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const leagues = [
      { shortcut: 'bl1', apiKey: 'bl1', season: '2025' },
      { shortcut: 'bl2', apiKey: 'bl2', season: '2025' }
    ]

    let totalUpdated = 0
    let totalErrors = 0

    for (const league of leagues) {
      console.log(`\n📊 Verarbeite ${league.shortcut.toUpperCase()}...`)

      // Hole aktuellen Spieltag
      const { data: currentMatchdayData } = await supabase
        .from('matches')
        .select('matchday')
        .eq('league_shortcut', league.shortcut)
        .eq('is_finished', false)
        .order('match_date', { ascending: true })
        .limit(1)

      if (!currentMatchdayData || currentMatchdayData.length === 0) {
        console.log(`   ⚠️ Kein offener Spieltag gefunden`)
        continue
      }

      const currentMatchday = currentMatchdayData[0].matchday
      console.log(`   📅 Aktueller Spieltag: ${currentMatchday}`)

      // Hole Spiele aus DB
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          matchday,
          home_team:teams!matches_home_team_id_fkey(id, name, short_name, openliga_api_id),
          away_team:teams!matches_away_team_id_fkey(id, name, short_name, openliga_api_id),
          is_finished,
          home_goals,
          away_goals
        `)
        .eq('league_shortcut', league.shortcut)
        .eq('matchday', currentMatchday)

      if (matchesError || !matches) {
        console.error(`   ❌ DB Fehler: ${matchesError?.message}`)
        totalErrors++
        continue
      }

      console.log(`   📋 ${matches.length} Matches aus DB geladen`)

      // Hole Ergebnisse von OpenLigaDB
      const apiUrl = `https://api.openligadb.de/getmatchdata/${league.apiKey}/${league.season}/${currentMatchday}`
      
      const apiResponse = await fetch(apiUrl)
      if (!apiResponse.ok) {
        console.error(`   ❌ API Error: ${apiResponse.status}`)
        totalErrors++
        continue
      }

      const apiMatches = await apiResponse.json()
      console.log(`   ✅ ${apiMatches.length} Spiele von API erhalten`)

      // Matche und aktualisiere
      let leagueUpdated = 0

      for (const match of matches) {
        // Finde API-Match - priorisiere openliga_api_id
        const apiMatch = apiMatches.find((api: any) => {
          const homeMatch = 
            (match.home_team.openliga_api_id && api.team1.teamName === match.home_team.openliga_api_id) ||
            api.team1.teamName === match.home_team.name ||
            api.team1.shortName === match.home_team.short_name

          const awayMatch = 
            (match.away_team.openliga_api_id && api.team2.teamName === match.away_team.openliga_api_id) ||
            api.team2.teamName === match.away_team.name ||
            api.team2.shortName === match.away_team.short_name

          return homeMatch && awayMatch
        })

        if (!apiMatch) {
          console.log(`   ⚠️ Kein Match: ${match.home_team.short_name} vs ${match.away_team.short_name}`)
          continue
        }

        // Prüfe ob Spiel beendet ist
        const isFinished = apiMatch.matchIsFinished
        const finalResult = apiMatch.matchResults?.find((r: any) => r.resultTypeID === 2) // Endstand

        if (!finalResult) {
          console.log(`   ℹ️ Noch kein Ergebnis: ${match.home_team.short_name} vs ${match.away_team.short_name}`)
          continue
        }

        const homeGoals = finalResult.pointsTeam1
        const awayGoals = finalResult.pointsTeam2

        // Update nur wenn sich was geändert hat
        if (
          match.home_goals !== homeGoals ||
          match.away_goals !== awayGoals ||
          match.is_finished !== isFinished
        ) {
          const { error: updateError } = await supabase
            .from('matches')
            .update({
              home_goals: homeGoals,
              away_goals: awayGoals,
              is_finished: isFinished
            })
            .eq('id', match.id)

          if (updateError) {
            console.error(`   ❌ Update Fehler für Match ${match.id}: ${updateError.message}`)
            totalErrors++
          } else {
            console.log(`   ✅ ${match.home_team.short_name} ${homeGoals}:${awayGoals} ${match.away_team.short_name} ${isFinished ? '(Beendet)' : '(Läuft)'}`)
            leagueUpdated++
          }
        }
      }

      console.log(`   📊 ${league.shortcut.toUpperCase()}: ${leagueUpdated} von ${matches.length} Matches aktualisiert`)
      totalUpdated += leagueUpdated
    }

    console.log(`\n✅ Gesamt: ${totalUpdated} Matches aktualisiert, ${totalErrors} Fehler`)

    return new Response(
      JSON.stringify({
        success: true,
        totalUpdated,
        totalErrors,
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Fehler:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
