import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const user  = JSON.parse(localStorage.getItem('user') || '{}')
  const home  = token
    ? user.role === 'dipendente' ? '/portale' : '/dashboard'
    : '/'

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex flex-col items-center justify-center p-6 text-center">
      <p className="font-mono text-5xl font-bold text-zinc-900 dark:text-white mb-3">404</p>
      <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Pagina non trovata</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-sm">
        La pagina che stai cercando non esiste o è stata spostata.
      </p>
      <button
        onClick={() => navigate(home)}
        className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 transition"
      >
        Torna alla home
      </button>
    </div>
  )
}
