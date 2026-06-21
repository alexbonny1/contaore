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

  return data
}
