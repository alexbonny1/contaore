import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Calendar, AlertCircle, FileText, Sun, Moon,
  LayoutDashboard, Users, CreditCard, Radio, Trash2
} from 'lucide-react'
import { API_URL } from '../api'

function statoBadge(stato) {
  switch (stato) {
    case 'in_attesa':  return { label: 'In attesa', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' }
    case 'approvata':  return { label: 'Approvata', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' }
    case 'rifiutata':  return { label: 'Rifiutata', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' }
    default: return { label: stato, color: 'bg-zinc-100 text-zinc-700' }
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
} 

export default function Requests() {
  const navigate = useNavigate()
  const location = useLocation()
  const [dark, setDark] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // all, ferie, giustificazioni, timbratura
  const [richieste, setRichieste] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [actionLoading, setActionLoading] = useState({})

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

  // LOAD RICHIESTE
  useEffect(() => {
    loadRichieste()
    const interval = setInterval(loadRichieste, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadRichieste() {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/requests/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        navigate('/')
        return
      }
      const data = await response.json()
      if (data.success) {
        setRichieste(data)
      } else {
        console.warn('loadRichieste error:', data.error)
      }
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  async function approveRequest(type, id) {
    try {
      setActionLoading(prev => ({ ...prev, [id]: true }))
      const token = localStorage.getItem('token')

      let endpoint = ''
      if (type === 'ferie') endpoint = `/api/ferie/${id}/approva`
      else if (type === 'giustificazioni') endpoint = `/api/giustificazioni/${id}/approva`
      else if (type === 'timbratura') endpoint = `/api/requests/missing-scans/${id}/approva`

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success) {
        showToast('Richiesta approvata ✓', 'success')
        loadRichieste()
      } else {
        showToast('Errore approvazione', 'error')
      }
    } catch (err) {
      console.log(err)
      showToast('Errore', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  async function rejectRequest(type, id) {
    try {
      setActionLoading(prev => ({ ...prev, [id]: true }))
      const token = localStorage.getItem('token')

      let endpoint = ''
      if (type === 'ferie') endpoint = `/api/ferie/${id}/rifiuta`
      else if (type === 'giustificazioni') endpoint = `/api/giustificazioni/${id}/rifiuta`
      else if (type === 'timbratura') endpoint = `/api/requests/missing-scans/${id}/rifiuta`

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success) {
        showToast('Richiesta rifiutata', 'success')
        loadRichieste()
      } else {
        showToast('Errore rifiuto', 'error')
      }
    } catch (err) {
      console.log(err)
      showToast('Errore', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  async function deleteRequest(type, id) {
    if (!window.confirm('Sei sicuro di voler eliminare questa richiesta? L\'operazione non è reversibile.')) return
    try {
      setActionLoading(prev => ({ ...prev, [`del_${id}`]: true }))
      const token = localStorage.getItem('token')

      let endpoint = ''
      if (type === 'ferie')      endpoint = `/api/ferie/${id}/admin`
      else if (type === 'timbratura') endpoint = `/api/requests/missing-scans/${id}/admin`

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success) {
        showToast('Richiesta eliminata', 'success')
        loadRichieste()
      } else {
        showToast('Errore eliminazione', 'error')
      }
    } catch (err) {
      console.log(err)
      showToast('Errore', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [`del_${id}`]: false }))
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
          <p className="text-zinc-600 dark:text-zinc-400">Caricamento richieste...</p>
        </div>
      </div>
    )
  }

  if (!richieste) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10]">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Errore caricamento</p>
        </div>
      </div>
    )
  }

  const { ferie, giustificazioni, richieste_timbratura } = richieste.richieste

  // Filtra per tab attivo
  let richiesteFiltrate = []
  if (activeTab === 'all') {
    richiesteFiltrate = [
      ...ferie.map(r => ({ ...r, type: 'ferie' })),
      ...giustificazioni.map(r => ({ ...r, type: 'giustificazioni' })),
      ...richieste_timbratura.map(r => ({ ...r, type: 'timbratura' }))
    ]
  } else if (activeTab === 'ferie') {
    richiesteFiltrate = ferie.map(r => ({ ...r, type: 'ferie' }))
  } else if (activeTab === 'giustificazioni') {
    richiesteFiltrate = giustificazioni.map(r => ({ ...r, type: 'giustificazioni' }))
  } else if (activeTab === 'timbratura') {
    richiesteFiltrate = richieste_timbratura.map(r => ({ ...r, type: 'timbratura' }))
  }

  // Ordina per data creazione (più recenti prima)
  richiesteFiltrate.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Richieste
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ferie, giustificazioni e timbrature
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
              {dark ? <Sun size={18} className="text-zinc-200" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
            <button
              onClick={logout}
              className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* NAV */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          {[
            { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
            { title: "Richieste",       icon: FileText,        path: "/requests"  },
            { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
            { title: "Dipendenti",      icon: Users,           path: "/employees" },
            { title: "Badge",           icon: CreditCard,      path: "/badges"    },
            { title: "Lettori NFC",     icon: Radio,           path: "/readers"   }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} to={item.path}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all ${
                  location.pathname === item.path
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}>
                <Icon size={16} />{item.title}
              </Link>
            );
          })}
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Totali in attesa</p>
            <h3 className="text-4xl font-bold mt-3 text-yellow-500">{richieste.counts.totali_in_attesa}</h3>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Ferie</p>
            <h3 className="text-4xl font-bold mt-3 text-blue-500">{richieste.counts.ferie_in_attesa}</h3>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Giustificazioni</p>
            <h3 className="text-4xl font-bold mt-3 text-purple-500">{richieste.counts.giustificazioni_in_attesa}</h3>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Timbrature</p>
            <h3 className="text-4xl font-bold mt-3 text-orange-500">{richieste.counts.timbratura_in_attesa}</h3>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Tutte', icon: FileText },
            { id: 'ferie', label: 'Ferie', icon: Calendar },
            { id: 'giustificazioni', label: 'Giustificazioni', icon: AlertCircle },
            { id: 'timbratura', label: 'Timbrature', icon: Clock }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* RICHIESTE LIST */}
        <div className="space-y-4">
          {richiesteFiltrate.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">Nessuna richiesta</p>
            </div>
          ) : (
            richiesteFiltrate.map(req => {
              const badge = statoBadge(req.stato)
              const isExpanded = expandedId === req.id
              const dipName = req.dipendenti ? `${req.dipendenti.nome} ${req.dipendenti.cognome}` : 'N/A'
              
              let typeIcon, typeLabel, typeColor
              if (req.type === 'ferie') {
                typeIcon = Calendar
                typeLabel = 'Ferie'
                typeColor = 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
              } else if (req.type === 'giustificazioni') {
                typeIcon = AlertCircle
                typeLabel = 'Giustificazione'
                typeColor = 'bg-purple-500/20 text-purple-600 dark:text-purple-300'
              } else {
                typeIcon = Clock
                typeLabel = 'Timbratura'
                typeColor = 'bg-orange-500/20 text-orange-600 dark:text-orange-300'
              }

              const TypeIcon = typeIcon

              return (
                <div
                  key={req.id}
                  className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1 text-left">
                      <div className={`p-3 rounded-2xl ${typeColor}`}>
                        <TypeIcon size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{dipName}</h3>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">{typeLabel}</p>
                        
                        {req.type === 'ferie' && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {formatDate(req.data_inizio)} → {formatDate(req.data_fine)}
                          </p>
                        )}
                        {req.type === 'giustificazioni' && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">{formatDate(req.data)}</p>
                        )}
                        {req.type === 'timbratura' && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {formatDate(req.data)} — {req.tipo || 'USCITA'} alle {req.ora_uscita}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>

                  {isExpanded && req.stato === 'in_attesa' && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6">
                      <div className="mb-6">
                        {req.type === 'ferie' && (
                          <div>
                            <p className="text-sm text-zinc-500 mb-2">Note:</p>
                            <p className="text-zinc-900 dark:text-zinc-100">{req.note || 'Nessuna nota'}</p>
                          </div>
                        )}
                        {req.type === 'giustificazioni' && (
                          <div>
                            <p className="text-sm text-zinc-500 mb-2">Motivo:</p>
                            <p className="text-zinc-900 dark:text-zinc-100">{req.motivo}</p>
                          </div>
                        )}
                        {req.type === 'timbratura' && (
                          <div>
                            <p className="text-sm text-zinc-500 mb-2">Motivo:</p>
                            <p className="text-zinc-900 dark:text-zinc-100">{req.motivo}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => approveRequest(req.type, req.id)}
                          disabled={actionLoading[req.id]}
                          className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {actionLoading[req.id] ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Approvando...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={18} />
                              Approva
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => rejectRequest(req.type, req.id)}
                          disabled={actionLoading[req.id]}
                          className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {actionLoading[req.id] ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Rifiutando...
                            </>
                          ) : (
                            <>
                              <XCircle size={18} />
                              Rifiuta
                            </>
                          )}
                        </button>
                        {(req.type === 'ferie' || req.type === 'timbratura') && (
                          <button
                            onClick={() => deleteRequest(req.type, req.id)}
                            disabled={actionLoading[`del_${req.id}`]}
                            className="px-4 py-3 rounded-2xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            title="Elimina richiesta"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isExpanded && req.stato !== 'in_attesa' && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-zinc-500">
                          {req.stato === 'approvata' ? '✓ Approvata' : '✗ Rifiutata'} il {formatDate(req.approvato_il)}
                        </p>
                        {(req.type === 'ferie' || req.type === 'timbratura') && (
                          <button
                            onClick={() => deleteRequest(req.type, req.id)}
                            disabled={actionLoading[`del_${req.id}`]}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-medium hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 size={15} />
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}