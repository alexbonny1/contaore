export const API_URL =
  import.meta.env.VITE_API_URL

function getUser() {
  return JSON.parse(localStorage.getItem("user") || "{}");
}

// Titolare e superadmin hanno sempre accesso; per un admin secondario serve il permesso specifico
export function hasPermission(perm) {
  const user = getUser();
  if (user.role === "owner" || user.role === "superadmin") return true;
  return !!user.permissions?.[perm];
}

// Basta almeno uno dei permessi indicati
export function hasAnyPermission(perms) {
  const user = getUser();
  if (user.role === "owner" || user.role === "superadmin") return true;
  return perms.some(p => user.permissions?.[p]);
}

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
