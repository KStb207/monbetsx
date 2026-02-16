// WICHTIG: NEUEN API-KEY verwenden!
const API_KEY = 'c9ad4d10accc71525070e29f937774ec'

async function getTeamNames(league) {
  const leagueKey = league === 'bl1' ? 'soccer_germany_bundesliga' : 'soccer_germany_bundesliga2'
  
  console.log(`\n📊 Lade Team-Namen für: ${league === 'bl1' ? '1. Bundesliga' : '2. Bundesliga'}\n`)
  
  try {
    const response = await fetch(
      // KORRIGIERT: tipico_de statt tipico!
      `https://api.the-odds-api.com/v4/sports/${leagueKey}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&bookmakers=tipico_de`
    )
    
    if (!response.ok) {
      console.error(`❌ Fehler: ${response.status} ${response.statusText}`)
      return
    }
    
    const data = await response.json()
    
    console.log(`✅ ${data.length} Spiele gefunden\n`)
    console.log('═'.repeat(80))
    
    const teams = new Set()
    
    data.forEach((game, index) => {
      teams.add(game.home_team)
      teams.add(game.away_team)
      
      console.log(`\nSpiel ${index + 1}: ${game.home_team} vs ${game.away_team}`)
      
      // KORRIGIERT: tipico_de prüfen!
      const hasTipico = game.bookmakers.some(b => b.key === 'tipico_de')
      if (hasTipico) {
        const tipico = game.bookmakers.find(b => b.key === 'tipico_de')
        const h2h = tipico.markets.find(m => m.key === 'h2h')
        const draw = h2h?.outcomes.find(o => o.name === 'Draw')
        console.log(`   ✓ Tipico X-Quote: ${draw?.price || 'N/A'}`)
      } else {
        console.log(`   ✗ Tipico nicht verfügbar`)
      }
    })
    
    console.log('\n' + '═'.repeat(80))
    console.log('\n📋 ALLE TEAM-NAMEN:\n')
    
    Array.from(teams).sort().forEach(team => {
      console.log(`'${team}'`)
    })
    
  } catch (error) {
    console.error('❌ Fehler:', error)
  }
}

async function getAllTeams() {
  await getTeamNames('bl1')
  await new Promise(resolve => setTimeout(resolve, 1000))
  await getTeamNames('bl2')
}

getAllTeams()