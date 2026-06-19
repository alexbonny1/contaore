export const API_URL =
  import.meta.env.VITE_API_URL
console.log(API_URL)

export async function apiFetch(
  endpoint,
  options = {}
) {

  const token =
    localStorage.getItem('token')

  const response = await fetch(
    API_URL + endpoint,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
          ? `Bearer ${token}`
          : '',
        ...(options.headers || {})
      }
    }
  )

  const data = await response.json()

  // Intercetta errore 2FA inattività (403 TWO_FACTOR_REQUIRED)
  if (response.status === 403 && data.error === 'TWO_FACTOR_REQUIRED') {
    // Salva i dati per la verifica 2FA
    sessionStorage.setItem('twoFactorInactivityData', JSON.stringify({
      tempToken: data.tempToken,
      method: data.method,
      message: data.message,
      status: 'INACTIVITY_2FA_REQUIRED'
    }))

    // Lancia un evento per notificare il frontend
    window.dispatchEvent(new CustomEvent('inactivity2FARequired', {
      detail: {
        tempToken: data.tempToken,
        method: data.method,
        message: data.message
      }
    }))

    // Ritorna un errore speciale
    return {
      ...data,
      isInactivity2FA: true
    }
  }

  return data
}
