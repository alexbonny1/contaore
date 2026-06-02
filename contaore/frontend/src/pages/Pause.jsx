import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Calendar, CheckCircle, XCircle, Sun, Moon, X,
  LayoutDashboard, Users, CreditCard, Radio, FileText
} from 'lucide-react'
import { API_URL } from '../api'

function formatDate(date) {
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Pause() {
  const navigate = useNavigate()
  const location = useLocation()
  const [dark, setDark] = useState(false)
  const [pausa, setPausa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pausaInizio, setPausaInizio] = useState('')
  const [pausaFine, setPausaFine] = useState('')
  const [pausaMotivo, setPausaMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const isFirstLoad = useRef(true)

  const user          = JSON.parse(localStorage.getItem('user') || '{}')
  const portaleAttivo = user.portale_dipendenti !== false

  // THEME 
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  // LOAD PAUSA
  useEffect(() => {
    loadPausa()
    const interval = setInterval(loadPausa, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0) })
      .catch(() => {})
  }, [])

  async function loadPausa() {
    try {
      if (isFirstLoad.current) setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/pausa-aziendale`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        navigate('/')
        return
      }

      const data = await response.json()
      if (data.success) {
        setPausa(data.pausa)
      } else {
        console.warn('loadPausa error:', data.error)
        setPausa(null)
      }
    } catch (err) {
      console.log(err)
      setPausa(null)
    } finally {
      if (isFirstLoad.current) {
        setLoading(false)
        isFirstLoad.current = false
      }
    }
  }

  async function createPausa(e) {
    e.preventDefault()
    if (!pausaInizio || !pausaFine || !pausaMotivo.trim()) {
      showToast('Compila tutti i campi', 'error')
      return
    }
    if (pausaInizio > pausaFine) {
      showToast('La data di inizio deve essere prima della fine', 'error')
      return
    }

    try {
      setSaving(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/pausa-aziendale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data_inizio: pausaInizio,
          data_fine: pausaFine,
          motivo: pausaMotivo.trim()
        })
      })
      const data = await response.json()
      if (data.success) {
        showToast('Pausa aziendale creata ✓', 'success')
        setPausaInizio('')
        setPausaFine('')
        setPausaMotivo('')
        setShowForm(false)
        loadPausa()
      } else {
        showToast(data.detail || data.message || data.error || 'Errore', 'error')
      }
    } catch (err) {
      console.log(err)
      showToast('Errore server', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function cancelPausa(id) {
    if (!window.confirm('Annullare la pausa aziendale?')) return
    try {
      setCancelLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/pausa-aziendale/${id}/annulla`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        showToast('Pausa aziendale annullata', 'success')
        loadPausa()
      } else {
        showToast('Errore', 'error')
      }
    } catch (err) {
      console.log(err)
      showToast('Errore server', 'error')
    } finally {
      setCancelLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Caricamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Timbry
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Gestisci le ferie dell'azienda
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
              {dark ? <Sun size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-200" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-700" />}
            </button>
            <button
              onClick={logout}
              className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* NAV */}
        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
            { title: "Richieste",       icon: FileText,        path: "/requests",  notifica: pendingCount, nascondiSeSenzaPortale: true },
            { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
            { title: "Dipendenti",      icon: Users,           path: "/employees" },
            { title: "Badge",           icon: CreditCard,      path: "/badges"    },
            { title: "Lettori NFC",     icon: Radio,           path: "/readers"   }
          ]
            .filter(item => !(item.nascondiSeSenzaPortale && !portaleAttivo))
            .map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.title} to={item.path}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}>
                <Icon size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">{item.title}</span>
                {!isActive && item.notifica > 0 && (
                  <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {item.notifica > 9 ? "9+" : item.notifica}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* SEZIONE PAUSA ATTIVA */}
        {pausa && pausa.attiva && (
          <div className="mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-4 sm:p-6">
            <div className="flex flex-col xs:flex-row items-start xs:items-center xs:justify-between gap-4 xs:gap-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-green-900 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                  Pausa aziendale attiva
                </h2>
                <p className="text-xs sm:text-sm text-green-700 dark:text-green-200 mt-2">
                  Dal <strong>{formatDate(pausa.data_inizio)}</strong> al <strong>{formatDate(pausa.data_fine)}</strong>
                </p>
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-300 mt-1">
                  <strong>Motivo:</strong> {pausa.motivo}
                </p>
                <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-300 mt-3">
                  Tutti i dipendenti sono segnati come in ferie durante questo periodo.
                </p>
              </div>
              <button
                onClick={() => cancelPausa(pausa.id)}
                disabled={cancelLoading}
                className="py-2 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-red-500 text-white text-xs sm:text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0"
              >
                {cancelLoading ? (
                  <>
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden xs:inline">Annullando...</span>
                  </>
                ) : (
                  <>
                    <X size={14} className="sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Annulla pausa</span>
                    <span className="xs:hidden">Annulla</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* FORM CREAZIONE PAUSA */}
        {!pausa || !pausa.attiva ? (
          <>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 h-9 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium mb-6 sm:mb-8"
              >
                <Calendar size={14} className="sm:w-4 sm:h-4" />
                Crea pausa aziendale
              </button>
            ) : (
              <form onSubmit={createPausa} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 mb-6 sm:mb-8">
                <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 sm:mb-4">Nuova pausa aziendale</h2>

                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-4 sm:mb-6">
                  Durante il periodo di pausa, tutti i dipendenti dell'azienda saranno automaticamente segnati come in ferie.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1.5 sm:mb-2">Data inizio</p>
                    <input
                      type="date"
                      value={pausaInizio}
                      onChange={e => setPausaInizio(e.target.value)}
                      className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-xs sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1.5 sm:mb-2">Data fine</p>
                    <input
                      type="date"
                      value={pausaFine}
                      onChange={e => setPausaFine(e.target.value)}
                      className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-xs sm:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4 sm:mb-6">
                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1.5 sm:mb-2">Motivo</p>
                  <textarea
                    rows={3}
                    placeholder="Es: Ferie estive, chiusura per manutenzione, ecc."
                    value={pausaMotivo}
                    onChange={e => setPausaMotivo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creando...
                      </>
                    ) : (
                      <>
                        <Calendar size={14} className="sm:w-4 sm:h-4" />
                        Crea pausa
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs sm:text-sm font-medium"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            )}
          </>
        ) : null}

        {/* INFORMAZIONI */}
        {!pausa || !pausa.attiva ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 text-center">
            <Calendar size={28} className="sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-zinc-400" />
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5 sm:mb-2">
              Nessuna pausa aziendale
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              Crea una pausa aziendale per segnare tutti i dipendenti come in ferie durante un periodo specifico (es: ferie estive).
            </p>
          </div>
        ) : null}
      </div>

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
