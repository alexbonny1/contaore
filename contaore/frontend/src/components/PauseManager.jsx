import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, CheckCircle, XCircle, X, Plus, UserCheck } from 'lucide-react'
import { API_URL } from '../api'

function formatDate(date) {
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function countDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1
}

/**
 * Gestione Pause aziendali / ferie — corpo riutilizzabile senza chrome di pagina.
 * Usato dentro la pagina combinata "Ferie & Permessi" (Requests.jsx).
 * Nessuna modifica alle API: /api/pausa-aziendale, /api/tags, /api/company/info.
 */
export default function PauseManager({ portaleAttivo: portaleAttivoProp }) {
  const navigate  = useNavigate()
  const [pause, setPause]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [pausaInizio, setPausaInizio] = useState('')
  const [pausaFine, setPausaFine]     = useState('')
  const [pausaMotivo, setPausaMotivo] = useState('')
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  // employee selection (only when portal is inactive)
  const [tipoFerie, setTipoFerie]         = useState('aziendale') // 'aziendale' | 'dipendenti'
  const [employees, setEmployees]         = useState([])
  const [selectedDips, setSelectedDips]   = useState(new Set())
  const [loadingEmps, setLoadingEmps]     = useState(false)

  const isFirstLoad = useRef(true)
  const user          = JSON.parse(localStorage.getItem('user') || '{}')
  // stato portale: prop dal layout se passata, altrimenti fallback da localStorage
  const portaleAttivo = portaleAttivoProp !== undefined ? portaleAttivoProp : (user.portale_dipendenti !== false)
  const token         = localStorage.getItem('token')

  // LOAD PAUSE
  useEffect(() => {
    loadPause()
    const interval = setInterval(loadPause, 15000)
    return () => clearInterval(interval)
  }, [])

  // LOAD EMPLOYEES (solo se portale inattivo)
  useEffect(() => {
    if (!portaleAttivo) loadEmployees()
  }, [])

  async function loadPause() {
    try {
      if (isFirstLoad.current) setLoading(true)
      const res  = await fetch(`${API_URL}/api/pausa-aziendale`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401 || res.status === 403) { navigate('/'); return }
      const data = await res.json()
      if (data.success) setPause(data.pause || [])
    } catch (err) {
      console.log(err)
    } finally {
      if (isFirstLoad.current) { setLoading(false); isFirstLoad.current = false }
    }
  }

  async function loadEmployees() {
    setLoadingEmps(true)
    try {
      const res  = await fetch(`${API_URL}/api/tags`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setEmployees(
          (data.tags || [])
            .filter(t => t.dipendente_id)
            .map(t => ({ id: t.dipendente_id, nome: t.nome }))
        )
      }
    } catch (err) { console.log(err) }
    finally { setLoadingEmps(false) }
  }

  function toggleDip(id) {
    setSelectedDips(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll()   { setSelectedDips(new Set(employees.map(e => e.id))) }
  function deselectAll() { setSelectedDips(new Set()) }

  async function createPausa(e) {
    e.preventDefault()
    if (!pausaInizio || !pausaFine || !pausaMotivo.trim()) {
      showToast('Compila tutti i campi', 'error'); return
    }
    if (pausaInizio > pausaFine) {
      showToast('La data di inizio deve essere prima della fine', 'error'); return
    }
    if (tipoFerie === 'dipendenti' && selectedDips.size === 0) {
      showToast('Seleziona almeno un dipendente', 'error'); return
    }

    try {
      setSaving(true)
      const body = {
        data_inizio: pausaInizio,
        data_fine:   pausaFine,
        motivo:      pausaMotivo.trim(),
        ...(tipoFerie === 'dipendenti' && { dipendente_ids: [...selectedDips] })
      }
      const res  = await fetch(`${API_URL}/api/pausa-aziendale`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        if (data.tipo === 'ferie_dipendenti') {
          const skippedMsg = data.skipped > 0 ? ` (${data.skipped} saltati per sovrapposizione)` : ''
          showToast(`Ferie create per ${data.created} dipendenti${skippedMsg}`, 'success')
        } else {
          showToast('Pausa aziendale creata ✓', 'success')
          loadPause()
        }
        setPausaInizio(''); setPausaFine(''); setPausaMotivo('')
        setSelectedDips(new Set()); setTipoFerie('aziendale')
        setShowForm(false)
      } else {
        showToast(data.detail || data.message || data.error || 'Errore', 'error')
      }
    } catch (err) {
      console.log(err); showToast('Errore server', 'error')
    } finally { setSaving(false) }
  }

  async function cancelPausa(id) {
    if (!window.confirm('Annullare questa pausa aziendale?')) return
    try {
      setCancellingId(id)
      const res  = await fetch(`${API_URL}/api/pausa-aziendale/${id}/annulla`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) { showToast('Pausa annullata', 'success'); loadPause() }
      else showToast('Errore', 'error')
    } catch (err) { console.log(err); showToast('Errore server', 'error') }
    finally { setCancellingId(null) }
  }

  function showToast(msg, type = 'success') {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const today = new Date().toISOString().split('T')[0]

  if (loading) return (
    <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-8 text-center">
      <div className="w-8 h-8 mx-auto rounded-full border-4 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 animate-spin" />
    </div>
  )

  return (
    <div>
      {/* HEADER ROW */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ferie</h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium">
            <Plus size={14} />
            <span className="hidden xs:inline">Nuova</span>
          </button>
        )}
      </div>

      {/* FORM CREAZIONE */}
      {showForm && (
        <form onSubmit={createPausa} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Nuova pausa / ferie</h3>

          {/* TOGGLE TIPO (solo se portale inattivo) */}
          {!portaleAttivo && (
            <div className="mb-5">
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-2">Applica a</p>
              <div className="flex gap-2">
                {[
                  { id: 'aziendale',  label: 'Tutti i dipendenti', icon: Calendar },
                  { id: 'dipendenti', label: 'Dipendenti specifici', icon: UserCheck }
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => { setTipoFerie(id); setSelectedDips(new Set()) }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      tipoFerie === id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}>
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DATE + MOTIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
            <div>
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1.5">Data inizio</p>
              <input type="date" value={pausaInizio} onChange={e => setPausaInizio(e.target.value)} required
                className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-xs sm:text-sm" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1.5">Data fine</p>
              <input type="date" value={pausaFine} onChange={e => setPausaFine(e.target.value)} required
                className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-xs sm:text-sm" />
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1.5">Motivo</p>
            <textarea rows={2} placeholder="Es: Ferie estive, chiusura per manutenzione…"
              value={pausaMotivo} onChange={e => setPausaMotivo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none" />
          </div>

          {/* SELEZIONE DIPENDENTI */}
          {tipoFerie === 'dipendenti' && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  Seleziona dipendenti <span className="text-zinc-400 font-normal">({selectedDips.size} selezionati)</span>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Tutti</button>
                  <button type="button" onClick={deselectAll} className="text-xs text-zinc-400 hover:underline">Nessuno</button>
                </div>
              </div>
              {loadingEmps ? (
                <p className="text-xs text-zinc-400">Caricamento…</p>
              ) : employees.length === 0 ? (
                <p className="text-xs text-zinc-400">Nessun dipendente trovato</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employees.map(emp => {
                    const sel = selectedDips.has(emp.id)
                    return (
                      <button key={emp.id} type="button" onClick={() => toggleDip(emp.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                          sel
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}>
                        {emp.nome}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 sm:gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creando…</>
                : <><Calendar size={14} />{tipoFerie === 'dipendenti' ? 'Crea ferie dipendenti' : 'Crea pausa'}</>
              }
            </button>
            <button type="button" onClick={() => { setShowForm(false); setTipoFerie('aziendale'); setSelectedDips(new Set()) }}
              className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs sm:text-sm font-medium">
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* LISTA PAUSE ATTIVE */}
      {pause.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {pause.map(p => {
            const isOngoing = p.data_inizio <= today && p.data_fine >= today
            const isFuture  = p.data_inizio > today
            const giorni    = countDays(p.data_inizio, p.data_fine)
            const daysLeft  = isOngoing ? countDays(today, p.data_fine) : null
            const daysTo    = isFuture  ? Math.round((new Date(p.data_inizio) - new Date(today)) / 86400000) : null
            return (
              <div key={p.id} className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-6 ${
                isOngoing
                  ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'
                  : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
              }`}>
                <div className="flex flex-col xs:flex-row items-start xs:items-center xs:justify-between gap-4 xs:gap-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={16} className={isOngoing ? 'text-orange-500' : 'text-green-600 dark:text-green-400'} />
                      <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {isOngoing ? 'In corso' : 'Programmata'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {giorni} {giorni === 1 ? 'giorno' : 'giorni'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                      Dal <strong>{formatDate(p.data_inizio)}</strong> al <strong>{formatDate(p.data_fine)}</strong>
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                      <strong>Motivo:</strong> {p.motivo}
                    </p>
                    {isOngoing && daysLeft !== null && (
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-1.5">
                        {daysLeft === 1 ? 'Ultimo giorno oggi' : `Ancora ${daysLeft} giorni`}
                      </p>
                    )}
                    {isFuture && daysTo !== null && (
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 mt-1.5">
                        {daysTo === 0 ? 'Inizia oggi' : daysTo === 1 ? 'Inizia domani' : `Inizia tra ${daysTo} giorni`}
                      </p>
                    )}
                  </div>
                  <button onClick={() => cancelPausa(p.id)} disabled={cancellingId === p.id}
                    className="py-2 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-red-500 text-white text-xs sm:text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                    {cancellingId === p.id
                      ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span className="hidden xs:inline">Annullando…</span></>
                      : <><X size={14} /><span className="hidden xs:inline">Annulla</span></>
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        !showForm && (
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 text-center">
            <Calendar size={28} className="sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-zinc-400" />
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Nessuna ferie programmata</h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              {portaleAttivo
                ? 'Crea una pausa aziendale per segnare tutti i dipendenti come in ferie durante un periodo specifico.'
                : 'Crea una pausa per tutti i dipendenti oppure aggiungi ferie a dipendenti specifici.'
              }
            </p>
          </div>
        )
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
