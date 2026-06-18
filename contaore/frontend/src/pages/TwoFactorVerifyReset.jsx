import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function TwoFactorVerifyReset() {
  const location = useLocation()
  const navigate = useNavigate()
  const { method = 'email', tempToken } = location.state || {}

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [timeLeft, setTimeLeft] = useState(600)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Redirect se non c'è tempToken
  useEffect(() => {
    if (!tempToken) {
      navigate('/reset-password')
    }
  }, [tempToken, navigate])

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return

    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [resendCooldown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(value)
    setError(null)
  }

  const handleVerify = async (e) => {
    e.preventDefault()

    if (code.length !== 6) {
      setError('Inserisci 6 cifre')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/auth/verify-2fa-reset', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code })
      })

      if (!response.success) {
        setError(response.error === 'INVALID_CODE' ? 'Codice non valido' : response.error)
        setCode('')
        return
      }

      // Success
      setSuccess(true)
      setError(null)

      // Redirect to login dopo 2 secondi
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError('Errore di verifica. Riprova.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/auth/resend-2fa-code', {
        method: 'POST',
        body: JSON.stringify({ tempToken })
      })

      if (response.success) {
        setCode('')
        setTimeLeft(600)
        setResendCooldown(30)
      } else {
        setError('Errore nell\'invio del codice')
      }
    } catch (err) {
      setError('Errore. Riprova.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!tempToken) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Verifica il cambio password
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Abbiamo inviato un codice via {method === 'email' ? 'email' : method}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4 text-green-700 dark:text-green-200 text-sm mb-6">
            Password resettata con successo! Reindirizzamento a login...
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-6">
          {/* Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Codice a 6 cifre
            </label>
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="000000"
              maxLength="6"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={loading || success}
              autoFocus
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Timer */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            {timeLeft > 0 ? (
              <>
                Codice valido per <span className="font-semibold text-gray-900 dark:text-white">{formatTime(timeLeft)}</span>
              </>
            ) : (
              <span className="text-red-600 dark:text-red-400">Il codice è scaduto. Richiedi un nuovo codice.</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || code.length !== 6 || timeLeft <= 0 || success}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 rounded-lg transition duration-200"
          >
            {loading ? 'Verifica in corso...' : 'Verifica Codice'}
          </button>
        </form>

        {/* Resend Code */}
        {!success && (
          <div className="mt-6 text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Potrai reinviare il codice fra {resendCooldown}s
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={loading || timeLeft > 540}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium disabled:text-gray-400"
              >
                Non hai ricevuto il codice? Reinvia
              </button>
            )}
          </div>
        )}

        {/* Info */}
        {!success && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-700 dark:text-blue-200 text-sm">
            <p className="font-medium mb-1">Per la tua sicurezza:</p>
            <ul className="text-xs space-y-1">
              <li>• Non condividere questo codice</li>
              <li>• Valido per 10 minuti</li>
              <li>• Usa e getta (monouso)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
