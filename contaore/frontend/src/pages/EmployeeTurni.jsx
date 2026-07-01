import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Briefcase, ChevronLeft } from "lucide-react";
import { API_URL, hasPermission } from "../api";
import { Toast } from "../components/SettingsUI";

const GIORNI = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

export default function EmployeeTurni() {
  const { id } = useParams();
  const canManage = hasPermission("can_manage_employees");

  const [employee, setEmployee]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [turni, setTurni]         = useState([]);
  const [turniAttivi, setTurniAttivi] = useState(false);
  const [toast, setToast]         = useState(null);

  const [editingShiftId, setEditingShiftId] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [turnoNome, setTurnoNome] = useState("");
  const [giorno, setGiorno]       = useState("Lunedì");
  const [giorniSelezionati, setGiorniSelezionati] = useState([]);
  const [ingresso1, setIngresso1] = useState("");
  const [uscita1, setUscita1]     = useState("");
  const [ingresso2, setIngresso2] = useState("");
  const [uscita2, setUscita2]     = useState("");

  function showToast(message, type = "success") { setToast({ message, type }); }
  function toggleGiorno(g) {
    setGiorniSelezionati(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/employees/" + id, { headers: { Authorization: "Bearer " + token } });
      const data  = await res.json();
      if (data.success) {
        setEmployee(data.employee);
        setTurni(data.employee.shifts || []);
        setTurniAttivi(!!data.employee.turni_attivi);
      }
    } catch (err) { }
    finally { setLoading(false); }
  }

  async function salvaTurno(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      if (editingShiftId) {
        const res = await fetch(API_URL + "/api/shifts/" + editingShiftId, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            turno_nome: turnoNome, giorno_settimana: giorno,
            ingresso_1: ingresso1 || null, uscita_1: uscita1 || null,
            ingresso_2: ingresso2 || null, uscita_2: uscita2 || null
          })
        });
        const data = await res.json();
        if (!data.success) { showToast("Errore salvataggio turno", "error"); return; }
      } else {
        const giorniDaCreare = giorniSelezionati.length > 0 ? giorniSelezionati : [giorno];
        for (const g of giorniDaCreare) {
          const res = await fetch(API_URL + "/api/employees/" + id + "/shift", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({
              turno_nome: turnoNome, giorno_settimana: g,
              ingresso_1: ingresso1 || null, uscita_1: uscita1 || null,
              ingresso_2: ingresso2 || null, uscita_2: uscita2 || null
            })
          });
          const data = await res.json();
          if (!data.success) { showToast("Errore salvataggio turno per " + g, "error"); return; }
        }
      }
      resetForm();
      loadData();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setSaving(false); }
  }

  async function eliminaTurno(shiftId) {
    if (!confirm("Eliminare turno?")) return;
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/shifts/" + shiftId, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      const data  = await res.json();
      if (!data.success) { showToast("Errore eliminazione", "error"); return; }
      loadData();
    } catch (err) { showToast("Errore server", "error"); }
  }

  async function toggleTurni() {
    try {
      const value = !turniAttivi;
      setTurniAttivi(value);
      const token = localStorage.getItem("token");
      await fetch(API_URL + "/api/employees/" + id + "/toggle-turni", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ turni_attivi: value })
      });
      loadData();
    } catch (err) { }
  }

  function startEditShift(shift) {
    setEditingShiftId(shift.id);
    setTurnoNome(shift.turno_nome || "");
    setGiorno(shift.giorno_settimana);
    setIngresso1(shift.ingresso_1 || "");
    setUscita1(shift.uscita_1 || "");
    setIngresso2(shift.ingresso_2 || "");
    setUscita2(shift.uscita_2 || "");
  }

  function resetForm() {
    setEditingShiftId(null);
    setTurnoNome(""); setGiorno("Lunedì"); setGiorniSelezionati([]);
    setIngresso1(""); setUscita1(""); setIngresso2(""); setUscita2("");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Link to={`/employees/${id}`} className="inline-flex items-center gap-0.5 -ml-1 mb-4 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
        <ChevronLeft size={18} /> {employee ? `${employee.nome} ${employee.cognome || ""}`.trim() : "Dipendente"}
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-5">Gestione turni</h1>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 text-center">
          <p className="text-sm text-zinc-400">Caricamento...</p>
        </div>
      ) : !canManage ? (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 text-center">
          <p className="text-sm text-zinc-400">Non hai i permessi per gestire i turni.</p>
        </div>
      ) : (
        <>
          {/* TOGGLE */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Turni attivi</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {turniAttivi ? "Assenze e straordinari calcolati" : "Attiva per tracciare assenze e straordinari"}
                </p>
              </div>
              <button
                onClick={toggleTurni}
                className={`w-16 h-9 rounded-2xl text-sm font-semibold transition-all ${turniAttivi ? "bg-green-500 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"}`}
              >
                {turniAttivi ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          {/* FORM */}
          {turniAttivi && (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">
              <div className="flex items-center gap-2 mb-5">
                <Briefcase size={18} className="text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {editingShiftId ? "Modifica turno" : "Aggiungi turno"}
                </h2>
              </div>

              <form onSubmit={salvaTurno} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Nome turno (es. Mattina)" value={turnoNome}
                    onChange={(e) => setTurnoNome(e.target.value)}
                    className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>

                <div>
                  <p className="text-xs text-zinc-400 mb-2">
                    {editingShiftId ? "Giorno" : "Giorni (seleziona uno o più)"}
                  </p>
                  {editingShiftId ? (
                    <select value={giorno} onChange={(e) => setGiorno(e.target.value)}
                      className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none">
                      {GIORNI.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {GIORNI.map(g => (
                        <button key={g} type="button" onClick={() => toggleGiorno(g)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            giorniSelezionati.includes(g)
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-transparent"
                              : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                          }`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                  {!editingShiftId && giorniSelezionati.length === 0 && (
                    <p className="text-xs text-zinc-400 mt-1">Seleziona almeno un giorno, oppure verrà usato Lunedì</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-zinc-400 mb-2">Primo turno</p>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="time" value={ingresso1} onChange={(e) => setIngresso1(e.target.value)}
                      className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                    <input type="time" value={uscita1} onChange={(e) => setUscita1(e.target.value)}
                      className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-zinc-400 mb-2">Secondo turno (opzionale)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="time" value={ingresso2} onChange={(e) => setIngresso2(e.target.value)}
                      className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                    <input type="time" value={uscita2} onChange={(e) => setUscita2(e.target.value)}
                      className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={saving}
                    className="h-11 px-6 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                    {saving ? "Salvataggio..." : editingShiftId ? "Modifica" : "Aggiungi turno"}
                  </button>
                  {editingShiftId && (
                    <button type="button" onClick={resetForm}
                      className="h-11 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
                      Annulla
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* LISTA */}
          {turniAttivi && turni.length > 0 && (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Turni assegnati</h2>
              <div className="space-y-3">
                {turni.map((t) => (
                  <div key={t.id} className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                          {t.turno_nome || "Turno"} — {t.giorno_settimana}
                          {t.uscita_1 && t.ingresso_1 && t.uscita_1 < t.ingresso_1 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Notturno</span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {t.ingresso_1} - {t.uscita_1}
                          {t.ingresso_2 && t.uscita_2 ? ` · ${t.ingresso_2} - ${t.uscita_2}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => startEditShift(t)} className="text-xs text-blue-500 hover:text-blue-700">Modifica</button>
                        <button onClick={() => eliminaTurno(t.id)} className="text-xs text-red-500 hover:text-red-700">Elimina</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
