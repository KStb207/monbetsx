import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// ÄNDERE DIESES PASSWORT!
//const CORRECT_PASSWORD = '21051996'
const CORRECT_PASSWORD = process.env.MONBETSX_PASSWORD || 'fallback'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    // Passwort-Check
    if (password === CORRECT_PASSWORD) {
      // Setze Session-Cookie (läuft beim Schließen ab)
      const cookieStore = await cookies()
      cookieStore.set('monbetsx_session', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: undefined // Session-Cookie (läuft beim Schließen ab)
      })

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Falsches Passwort' },
        { status: 401 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
} 
