export const API_URL =
  import.meta.env.VITE_API_URL

export function handleSessionExpired() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.location.href = '/?session_expired=1'
}

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

  if (data.error === 'SESSION_EXPIRED') {
    handleSessionExpired()
    return data
  }

  return data
}
