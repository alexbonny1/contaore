import { useState } from "react";
import { LayoutGrid, LayoutList } from "lucide-react";
import {
  getEmployeeViewMode, setEmployeeViewMode,
  getEmployeeViewColumns, setEmployeeViewColumns
} from "../employeeView";

/* Riga "Vista dipendenti" pronta per essere inserita dentro un <SettingsGroup> */
export function EmployeeViewRow() {
  const [mode, setMode]       = useState(getEmployeeViewMode);
  const [columns, setColumns] = useState(getEmployeeViewColumns);

  function chooseMode(value) {
    setEmployeeViewMode(value);
    setMode(value);
  }

  function chooseColumns(value) {
    setEmployeeViewColumns(value);
    setColumns(value);
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-800">
          <LayoutGrid size={18} className="text-zinc-600 dark:text-zinc-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Vista dipendenti</p>
          <p className="text-xs text-zinc-500 truncate">Elenco dettagliato o griglia compatta</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 shrink-0">
          <button type="button" onClick={() => chooseMode("list")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === "list" ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            <LayoutList size={13} /> Lista
          </button>
          <button type="button" onClick={() => chooseMode("grid")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === "grid" ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            <LayoutGrid size={13} /> Griglia
          </button>
        </div>
      </div>

      {mode === "grid" && (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Colonne griglia</p>
            <p className="text-xs text-zinc-500 truncate">Quante card per riga su telefono</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 shrink-0">
            {[2, 3].map((n) => (
              <button key={n} type="button" onClick={() => chooseColumns(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  columns === n ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
