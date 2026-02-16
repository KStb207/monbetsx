// app/login/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pin, setPin] = useState(['', '', '', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ]

  useEffect(() => {
    // Fokus auf erstes Feld beim Laden
    inputRefs[0].current?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Nur letzte Ziffer nehmen (falls mehrere eingegeben)
    const lastChar = value.slice(-1)
    
    // Nur Zahlen erlauben
    if (lastChar && !/^\d$/.test(lastChar)) return

    const newPin = [...pin]
    newPin[index] = lastChar

    setPin(newPin)
    setError('')

    // Auto-focus auf nächstes Feld
    if (lastChar && index < 7) {
      inputRefs[index + 1].current?.focus()
    }

    // Auto-submit wenn 8 Ziffern eingegeben
    if (newPin.every(digit => digit !== '') && index === 7) {
      handleSubmit(newPin.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: Zurück zum vorherigen Feld
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 8)
    
    if (/^\d+$/.test(pastedData)) {
      const newPin = pastedData.split('').concat(['', '', '', '', '', '', '', '']).slice(0, 8)
      setPin(newPin)
      
      // Fokus auf letztes gefülltes Feld
      const lastIndex = Math.min(pastedData.length - 1, 7)
      inputRefs[lastIndex].current?.focus()
      
      // Auto-submit wenn 8 Ziffern
      if (pastedData.length === 8) {
        handleSubmit(pastedData)
      }
    }
  }

  const handleSubmit = async (pinCode?: string) => {
    const finalPin = pinCode || pin.join('')
    
    if (finalPin.length !== 8) {
      setError('Bitte 8-stellige PIN eingeben')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: finalPin })
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('Falsche PIN')
        setPin(['', '', '', '', '', '', '', ''])
        inputRefs[0].current?.focus()
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten')
      setPin(['', '', '', '', '', '', '', ''])
      inputRefs[0].current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-slate-800">
          MonBetsX
        </h1>
        <p className="text-center text-slate-600 mb-8">
          Bitte 8-stellige PIN eingeben
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-6">
          {/* PIN Input */}
          <div className="flex justify-center gap-2">
            {pin.map((digit, index) => {
              const maskLetters = ['M', 'o', 'n', 'B', 'e', 't', 's', 'X']
              return (
                <div key={index} className="relative">
                  {/* Sichtbares Display-Feld */}
                  <div 
                    className="w-12 h-12 text-center text-2xl leading-[48px] font-bold border-2 border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition text-slate-900 bg-white cursor-pointer"
                    onClick={() => inputRefs[index].current?.focus()}
                  >
                    {digit ? maskLetters[index] : ''}
                  </div>
                  {/* Unsichtbares Input-Feld für Eingabe */}
                  <input
                    ref={inputRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    onFocus={(e) => e.target.select()}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              )
            })}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pin.some(d => !d)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? 'Überprüfe...' : 'Anmelden'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-6">
          Session läuft beim Schließen/Refresh ab
        </p>
      </div>
    </div>
  )
}