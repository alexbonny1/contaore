import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false)
  const [method, setMethod] = useState('email')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [tempToken, setTempToken] = useState(null)
  const [verifyError, setVerifyError] = useState(null)

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiFetch('/api/auth/2fa-status')
        if (response.success) {
          setEnabled(response.enabled || false)
          setMethod('email') // Default method
        }
      } catch (err) {
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned) return ''
    return '+' + cleaned
  }

  const handlePhoneChange = (e) => {
    const value = formatPhoneNumber(e.target.value)
    setPhoneNumber(value)
    setError(null)
  }

  const handleMethodChange = (newMethod) => {
    setMethod(newMethod)
    setError(null)
  }

  const handleToggle = (newValue) => {
    setEnabled(newValue)
    setError(null)
    setSuccess(false)
  }

  const validatePhoneNumber = (phone) => {
    // Basic validation: +39 per Italia, almeno 10 cifre
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length >= 10 && cleaned.length <= 15
  }

  const handleSaveMethod = async () => {
    setError(null)
    setVerifyError(null)

    // Validations
    if ((method === 'sms' || method === 'whatsapp') && !phoneNumber) {
      setError(`Inserisci un numero telefonico per ${method.toUpperCase()}`)
      return
    }

    if ((method === 'sms' || method === 'whatsapp') && !validatePhoneNumber(phoneNumber)) {
      setError('Numero telefonico non valido')
      return
    }

    setSaving(true)

    try {
      const response = await apiFetch('/api/user/2fa-settings', {
        method: 'PUT',
        body: JSON.stringify({ method, phoneNumber })
      })

      if (response.status === 'VERIFY_REQUIRED') {
        setTempToken(response.tempToken)
        setShowVerification(true)
        setVerificationCode('')
      } else {
        setError('Errore durante l\'aggiornamento')
      }
    } catch (err) {
      setError('Errore durante l\'aggiornamento: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleVerifyMethod = async () => {
    if (verificationCode.length !== 6) {
      setVerifyError('Inserisci 6 cifre')
      return
    }

    setVerifyLoading(true)
    setVerifyError(null)

    try {
      const response = await apiFetch('/api/user/verify-2fa-method', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code: verificationCode })
      })

      if (response.success) {
        setShowVerification(false)
        setTempToken(null)
        setVerificationCode('')
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setVerifyError('Codice non valido')
      }
    } catch (err) {
      setVerifyError('Errore: ' + err.message)
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleToggle2FA = async (newValue) => {
    handleToggle(newValue)

    setSaving(true)
    try {
      const response = await apiFetch('/api/auth/2fa-settings', {
        method: 'PUT',
        body: JSON.stringify({ two_factor_enabled: newValue })
      })

      if (response.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('Errore durante l\'aggiornamento')
        setEnabled(!newValue) // Rollback
      }
    } catch (err) {
      setError('Errore: ' + err.message)
      setEnabled(!newValue) // Rollback
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Autenticazione a due fattori (2FA)
        </h3>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-200 text-sm">
            Impostazioni aggiornate correttamente
          </div>
        )}

        {/* Toggle 2FA */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Abilita 2FA</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Richiede verifica dopo 15 minuti di inattività
              </p>
            </div>
            <button
              onClick={() => handleToggle2FA(!enabled)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
              } ${saving ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {enabled && !showVerification && (
          <>
            {/* Method Selection */}
            <div className="mb-6">
              <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Metodo di verifica
              </p>
              <div className="space-y-3">
                {['email', 'sms', 'whatsapp'].map(m => (
                  <label key={m} className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="method"
                      value={m}
                      checked={method === m}
                      onChange={() => handleMethodChange(m)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 text-gray-900 dark:text-white font-medium">
                      {m === 'email' ? '📧 Email' : m === 'sms' ? '📱 SMS' : '💬 WhatsApp'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Phone Number (if SMS or WhatsApp) */}
            {(method === 'sms' || method === 'whatsapp') && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Numero telefonico
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="+39 123 456 7890"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Formato: +39 seguito dalle cifre del numero
                </p>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSaveMethod}
              disabled={saving || (method !== 'email' && !phoneNumber)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition duration-200"
            >
              {saving ? 'Salvataggio...' : 'Salva e Verifica'}
            </button>
          </>
        )}

        {showVerification && (
          <>
            {/* Verification Code */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                Abbiamo inviato un codice a 6 cifre. Inseriscilo qui:
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setVerifyError(null)
                }}
                placeholder="000000"
                maxLength="6"
                className="w-full px-4 py-2 text-center text-xl font-mono tracking-widest border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-blue-600"
              />
            </div>

            {verifyError && (
              <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-200 text-sm">
                {verifyError}
              </div>
            )}

            <button
              onClick={handleVerifyMethod}
              disabled={verifyLoading || verificationCode.length !== 6}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition duration-200"
            >
              {verifyLoading ? 'Verifica...' : 'Verifica Codice'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
