import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

/* Toast condiviso impostazioni */
export function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`anim-toast fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium w-[calc(100%-32px)] sm:w-auto ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

/* Toggle pill in stile iOS */
export function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${value ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

/* Header di una sotto-pagina impostazioni: back + titolo */
export function SettingsHeader({ title, subtitle }) {
  return (
    <div className="mb-2">
      <Link to="/impostazioni" className="inline-flex items-center gap-0.5 -ml-1 mb-3 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
        <ChevronLeft size={18} /> Impostazioni
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* Riga categoria in stile Apple (icona colorata + titolo + chevron) */
export function SettingRow({ to, onClick, icon: Icon, iconBg, iconColor, title, subtitle, rightContent }) {
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{title}</p>
        {subtitle && <p className="text-xs text-zinc-500 truncate">{subtitle}</p>}
      </div>
      {rightContent !== undefined ? rightContent : <ChevronRight size={18} className="text-zinc-300 dark:text-zinc-600 shrink-0" />}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
        {inner}
      </button>
    );
  }
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
      {inner}
    </Link>
  );
}

/* Gruppo di righe in una card unica con divisori (stile Apple) */
export function SettingsGroup({ children }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
      {children}
    </div>
  );
}

/* Selezione dipendenti: toggle "tutti" + chip multi-select (riusato in Gestione dati e Invio riepilogo ore) */
export function EmployeeSelector({ employees, tutti, onTuttiChange, selected, onToggle }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tutti i dipendenti</span>
        <Toggle value={tutti} onChange={onTuttiChange} />
      </label>
      {!tutti && (
        <div className="flex flex-wrap gap-2 pt-1">
          {employees.map(emp => {
            const sel = selected.has(emp.id);
            return (
              <button key={emp.id} type="button" onClick={() => onToggle(emp.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  sel ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-transparent"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}>
                {emp.nome} {emp.cognome}
              </button>
            );
          })}
          {employees.length === 0 && <p className="text-xs text-zinc-400">Nessun dipendente</p>}
        </div>
      )}
    </div>
  );
}

/* Selettore giorno del mese (1-28, per evitare mesi corti) — riusato per pulizia automatica e invio riepilogo */
export function DaySelector({ value, onChange }) {
  const giorni = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
    >
      {giorni.map(g => <option key={g} value={g}>Giorno {g}</option>)}
    </select>
  );
}
