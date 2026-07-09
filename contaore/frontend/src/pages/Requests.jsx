import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Calendar, AlertCircle, FileText, Trash2, Pencil
} from 'lucide-react'
import { API_URL, hasPermission } from '../api'
import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh.jsx'
import PauseManager from '../components/PauseManager'
import { track } from '../analytics'

function statoBadge(stato) {
  switch (stato) {
    case 'in_attesa': return { label: 'In attesa', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' }
    case 'approvata': return { label: 'Approvata', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' }
    case 'rifiutata': return { label: 'Rifiutata', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' }
    default:          return { label: stato,       color: 'bg-zinc-100 text-zinc-700' }
  }
}

function fmt(date) {
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Requests({ initialView = 'richieste' }) {
  const { portaleAttivo, requestsData, refreshRequests } = useOutletContext()
  const [vista, setVista]           = useState(initialView)
  const [activeTab, setActiveTab]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('in_attesa')
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast]           = useState(null)
  const [actionLoading, setActionLoading] = useState({})
  // optimistic: { [id]: 'approvata' | 'rifiutata' | 'deleted' }
  const [optimistic, setOptimistic] = useState({})

  // dati richieste dal layout persistente (render immediato, niente spinner ad ogni apertura)
  const richieste = requestsData
  const loading   = requestsData === null

  const { pulling, refreshing, distance } = usePullToRefresh(refreshRequests)

  async function approveRequest(type, id) {
    const prev = optimistic[id]
    setOptimistic(o => ({ ...o, [id]: 'approvata' }))
    setActionLoading(p => ({ ...p, [id]: true }))
    try {
      const token = localStorage.getItem('token')
      const ep = type === 'ferie' ? `/api/ferie/${id}/approva`
               : type === 'giustificazioni' ? `/api/giustificazioni/${id}/approva`
               : type === 'permessi' ? `/api/requests/permessi/${id}/approva`
               : type === 'modifica-turni' ? `/api/requests/modifica-turni/${id}/approva`
               : `/api/requests/missing-scans/${id}/approva`
      const res  = await fetch(`${API_URL}${ep}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        track('request_approved', { type })
        showToast('Richiesta approvata ✓', 'success')
        refreshRequests()
      } else {
        setOptimistic(o => { const n = { ...o }; prev === undefined ? delete n[id] : (n[id] = prev); return n })
        showToast('Errore approvazione', 'error')
      }
    } catch {
      setOptimistic(o => { const n = { ...o }; prev === undefined ? delete n[id] : (n[id] = prev); return n })
      showToast('Errore', 'error')
    }
    finally { setActionLoading(p => ({ ...p, [id]: false })) }
  }

  async function rejectRequest(type, id) {
    const prev = optimistic[id]
    setOptimistic(o => ({ ...o, [id]: 'rifiutata' }))
    setActionLoading(p => ({ ...p, [id]: true }))
    try {
      const token = localStorage.getItem('token')
      const ep = type === 'ferie' ? `/api/ferie/${id}/rifiuta`
               : type === 'giustificazioni' ? `/api/giustificazioni/${id}/rifiuta`
               : type === 'permessi' ? `/api/requests/permessi/${id}/rifiuta`
               : type === 'modifica-turni' ? `/api/requests/modifica-turni/${id}/rifiuta`
               : `/api/requests/missing-scans/${id}/rifiuta`
      const res  = await fetch(`${API_URL}${ep}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        track('request_rejected', { type })
        showToast('Richiesta rifiutata', 'success')
        refreshRequests()
      } else {
        setOptimistic(o => { const n = { ...o }; prev === undefined ? delete n[id] : (n[id] = prev); return n })
        showToast('Errore rifiuto', 'error')
      }
    } catch {
      setOptimistic(o => { const n = { ...o }; prev === undefined ? delete n[id] : (n[id] = prev); return n })
      showToast('Errore', 'error')
    }
    finally { setActionLoading(p => ({ ...p, [id]: false })) }
  }

  async function deleteRequest(type, id) {
    if (!window.confirm('Eliminare questa richiesta?')) return
    setOptimistic(o => ({ ...o, [id]: 'deleted' }))
    setActionLoading(p => ({ ...p, [`del_${id}`]: true }))
    try {
      const token = localStorage.getItem('token')
      const ep = type === 'ferie' ? `/api/ferie/${id}/admin` : `/api/requests/missing-scans/${id}/admin`
      const res  = await fetch(`${API_URL}${ep}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) { showToast('Richiesta eliminata', 'success'); refreshRequests() }
      else {
        setOptimistic(o => { const n = { ...o }; delete n[id]; return n })
        showToast('Errore eliminazione', 'error')
      }
    } catch {
      setOptimistic(o => { const n = { ...o }; delete n[id]; return n })
      showToast('Errore', 'error')
    }
    finally { setActionLoading(p => ({ ...p, [`del_${id}`]: false })) }
  }

  function showToast(msg, type = 'success') {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const { ferie = [], giustificazioni = [], richieste_timbratura = [], richieste_permessi = [], richieste_turni = [] } = richieste?.richieste || {}

  let richiesteFiltrate = []
  if      (activeTab === 'all')            richiesteFiltrate = [...ferie.map(r => ({...r,type:'ferie'})), ...giustificazioni.map(r => ({...r,type:'giustificazioni'})), ...richieste_timbratura.map(r => ({...r,type:'timbratura'})), ...richieste_permessi.map(r => ({...r,type:'permessi'})), ...richieste_turni.map(r => ({...r,type:'modifica-turni'}))]
  else if (activeTab === 'ferie')          richiesteFiltrate = ferie.map(r => ({...r,type:'ferie'}))
  else if (activeTab === 'giustificazioni')richiesteFiltrate = giustificazioni.map(r => ({...r,type:'giustificazioni'}))
  else if (activeTab === 'timbratura')     richiesteFiltrate = richieste_timbratura.map(r => ({...r,type:'timbratura'}))
  else if (activeTab === 'permessi')       richiesteFiltrate = richieste_permessi.map(r => ({...r,type:'permessi'}))
  else if (activeTab === 'modifica-turni') richiesteFiltrate = richieste_turni.map(r => ({...r,type:'modifica-turni'}))
  // apply optimistic state before status filter so the UI updates instantly
  richiesteFiltrate = richiesteFiltrate
    .filter(r => optimistic[r.id] !== 'deleted')
    .map(r => optimistic[r.id] ? { ...r, stato: optimistic[r.id] } : r)
  richiesteFiltrate = richiesteFiltrate.filter(r => r.stato === statusFilter)
  richiesteFiltrate.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const allByType = activeTab === 'all'
    ? [...ferie.map(r => ({...r,type:'ferie'})), ...giustificazioni.map(r => ({...r,type:'giustificazioni'})), ...richieste_timbratura.map(r => ({...r,type:'timbratura'})), ...richieste_permessi.map(r => ({...r,type:'permessi'})), ...richieste_turni.map(r => ({...r,type:'modifica-turni'}))]
    : activeTab === 'ferie' ? ferie.map(r => ({...r,type:'ferie'}))
    : activeTab === 'giustificazioni' ? giustificazioni.map(r => ({...r,type:'giustificazioni'}))
    : activeTab === 'timbratura' ? richieste_timbratura.map(r => ({...r,type:'timbratura'}))
    : activeTab === 'permessi' ? richieste_permessi.map(r => ({...r,type:'permessi'}))
    : richieste_turni.map(r => ({...r,type:'modifica-turni'}))

  const statusCounts = {
    in_attesa: allByType.filter(r => r.stato === 'in_attesa').length,
    approvata: allByType.filter(r => r.stato === 'approvata').length,
    rifiutata: allByType.filter(r => r.stato === 'rifiutata').length,
  }

  const counts = richieste?.counts || {}
  const STATS = [
    { label: 'In attesa',    value: counts.totali_in_attesa ?? 0,         color: 'text-yellow-500' },
    { label: 'Ferie',        value: counts.ferie_in_attesa ?? 0,           color: 'text-blue-500'   },
    { label: 'Giustifiche',  value: counts.giustificazioni_in_attesa ?? 0, color: 'text-purple-500'},
    { label: 'Timbrature',   value: counts.timbratura_in_attesa ?? 0,      color: 'text-orange-500' },
    { label: 'Permessi',     value: counts.permessi_in_attesa ?? 0,        color: 'text-green-500'  },
    { label: 'Modifica turni', value: counts.turni_in_attesa ?? 0,        color: 'text-indigo-500' },
  ]

  if (!hasPermission('can_approve_requests')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Accesso non consentito</h3>
          <p className="text-sm text-zinc-500">Non hai i permessi per gestire le richieste.</p>
        </div>
      </div>
    )
  }

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

        {/* PULL INDICATOR */}
        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        {/* TITLE */}
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4 sm:mb-5">{portaleAttivo ? 'Ferie & Permessi' : 'Ferie'}</h1>

        {/* SEGMENTED CONTROL (Apple) — solo se portale dipendenti attivo */}
        {portaleAttivo && (
          <div className="flex p-1 mb-5 sm:mb-6 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/60 backdrop-blur-sm">
            {[
              { id: 'richieste', label: 'Richieste' },
              { id: 'pause',     label: 'Ferie' },
            ].map(seg => (
              <button key={seg.id} onClick={() => setVista(seg.id)}
                className={`flex-1 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  vista === seg.id
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                {seg.label}
              </button>
            ))}
          </div>
        )}

        {!portaleAttivo || vista === 'pause' ? (
          <PauseManager portaleAttivo={portaleAttivo} />
        ) : loading ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-4 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 animate-spin" />
          </div>
        ) : !richieste ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-zinc-500 text-sm">Errore caricamento</p>
          </div>
        ) : (
        <>
        {/* FILTER TABS */}
        <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all',            label: 'Tutte',         icon: FileText    },
            { id: 'ferie',          label: 'Ferie',         icon: Calendar    },
            { id: 'giustificazioni',label: 'Giustifiche',   icon: AlertCircle },
            { id: 'timbratura',     label: 'Timbrature',    icon: Clock       },
            { id: 'permessi',       label: 'Permessi',      icon: AlertCircle },
            { id: 'modifica-turni', label: 'Modifica turni', icon: Clock     }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}>
                <Icon size={13} className="sm:w-4 sm:h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* STATUS SEGMENTED CONTROL (Apple-style) */}
        <div className="flex p-1 mb-4 sm:mb-6 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60">
          {[
            { id: 'in_attesa', label: 'In attesa', count: statusCounts.in_attesa },
            { id: 'approvata', label: 'Approvate', count: statusCounts.approvata },
            { id: 'rifiutata', label: 'Rifiutate', count: statusCounts.rifiutata },
          ].map(seg => (
            <button
              key={seg.id}
              onClick={() => { setStatusFilter(seg.id); setExpandedId(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                statusFilter === seg.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {seg.label}
              {seg.count > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                  statusFilter === seg.id
                    ? seg.id === 'in_attesa' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                      : seg.id === 'approvata' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {seg.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* LIST */}
        <div className="space-y-2 sm:space-y-3">
          {richiesteFiltrate.length === 0 ? (
            <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 text-center">
              <p className="text-zinc-400 text-sm">Nessuna richiesta</p>
            </div>
          ) : (
            richiesteFiltrate.map(req => {
              const badge    = statoBadge(req.stato)
              const isExpanded = expandedId === req.id
              const dipName  = req.dipendenti ? `${req.dipendenti.nome} ${req.dipendenti.cognome}` : 'N/A'

              const typeInfo = req.type === 'ferie'
                ? { icon: Calendar,    label: 'Ferie',             color: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' }
                : req.type === 'giustificazioni'
                ? { icon: AlertCircle, label: 'Giustificazione',   color: 'bg-purple-500/15 text-purple-600 dark:text-purple-300' }
                : req.type === 'permessi'
                ? { icon: AlertCircle, label: 'Permesso',          color: 'bg-green-500/15 text-green-600 dark:text-green-300' }
                : req.type === 'modifica-turni'
                ? { icon: Clock,       label: 'Modifica turni',    color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' }
                : req.presenza_id
                ? { icon: Pencil,      label: 'Modifica timbratura', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' }
                : { icon: Clock,       label: 'Timbratura mancante', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' }
              const TypeIcon = typeInfo.icon

              return (
                <div key={req.id} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 overflow-hidden">

                  {/* ROW */}
                  <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left">
                    <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 ${typeInfo.color}`}>
                      <TypeIcon size={14} className="sm:w-4 sm:h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{dipName}</span>
                        <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.color}`}>{badge.label}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">{typeInfo.label}</p>
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-0.5">
                        {req.type === 'ferie'          && `${fmt(req.data_inizio)} → ${fmt(req.data_fine)}`}
                        {req.type === 'giustificazioni' && fmt(req.data)}
                        {req.type === 'permessi' && (
                          req.data_uscita && req.ora_uscita
                            ? `${fmt(req.data_uscita)} ${req.ora_uscita} (uscita)`
                            : req.data_entrata && req.ora_entrata
                            ? `${fmt(req.data_entrata)} ${req.ora_entrata} (entrata)`
                            : 'Permesso'
                        )}
                        {req.type === 'modifica-turni' && `${fmt(req.data_dal)} → ${fmt(req.data_al)}`}
                        {req.type === 'timbratura' && req.presenza_id  && `${fmt(req.data)} — ${req.tipo} → ${req.ora_uscita}`}
                        {req.type === 'timbratura' && !req.presenza_id && `${fmt(req.data)} — ${req.tipo || 'USCITA'} ore ${req.ora_uscita}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-zinc-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* EXPANDED: IN ATTESA */}
                  {isExpanded && req.stato === 'in_attesa' && (
                    <div className="anim-page border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 sm:px-6 py-3 sm:py-4">
                      {(req.note || req.motivo) && (
                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mb-3">
                          <span className="text-zinc-400">Note: </span>{req.note || req.motivo}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => approveRequest(req.type, req.id)} disabled={actionLoading[req.id]}
                          className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-green-500 text-white text-xs sm:text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {actionLoading[req.id]
                            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Approvando…</>
                            : <><CheckCircle size={14} />Approva</>}
                        </button>
                        <button onClick={() => rejectRequest(req.type, req.id)} disabled={actionLoading[req.id]}
                          className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-red-500 text-white text-xs sm:text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {actionLoading[req.id]
                            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Rifiutando…</>
                            : <><XCircle size={14} />Rifiuta</>}
                        </button>
                        {(req.type === 'ferie' || req.type === 'timbratura') && (
                          <button onClick={() => deleteRequest(req.type, req.id)} disabled={actionLoading[`del_${req.id}`]}
                            className="px-3 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 flex items-center justify-center">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* EXPANDED: PROCESSED */}
                  {isExpanded && req.stato !== 'in_attesa' && (
                    <div className="anim-page border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
                      <p className="text-xs sm:text-sm text-zinc-500">
                        {req.stato === 'approvata' ? '✓ Approvata' : '✗ Rifiutata'}
                        {req.approvato_il && ` il ${fmt(req.approvato_il)}`}
                      </p>
                      {(req.type === 'ferie' || req.type === 'timbratura') && (
                        <button onClick={() => deleteRequest(req.type, req.id)} disabled={actionLoading[`del_${req.id}`]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 text-xs font-medium hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50 transition-colors">
                          <Trash2 size={13} />Elimina
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* RIEPILOGO CONTEGGI — card unica */}
        <div className="mt-5 sm:mt-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
          <div className="grid grid-cols-4 divide-x divide-zinc-200 dark:divide-zinc-800">
            {STATS.map(s => (
              <div key={s.label} className="flex flex-col items-center text-center px-1">
                <span className={`text-2xl sm:text-4xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-[10px] sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        </>
        )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
      </div>
  )
}
