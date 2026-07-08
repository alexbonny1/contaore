import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { getThemePref, setThemePref } from "../theme";

const OPTIONS = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark",  label: "Scuro",  icon: Moon },
  { value: "auto",  label: "Auto",   icon: Monitor },
];

/* Selettore a 3 vie Chiaro/Scuro/Automatico, riusato in Settings, admin e portale dipendente */
export function ThemeSegmented({ compact = false }) {
  const [pref, setPref] = useState(getThemePref);

  function choose(value) {
    setThemePref(value);
    setPref(value);
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 shrink-0">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            pref === value
              ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <Icon size={13} />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}

/* Riga "Tema" pronta per essere inserita dentro un <SettingsGroup> */
export function ThemeRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-800">
        <Monitor size={18} className="text-zinc-600 dark:text-zinc-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Tema</p>
        <p className="text-xs text-zinc-500 truncate">Chiaro, scuro o automatico (segue il sistema)</p>
      </div>
      <ThemeSegmented compact />
    </div>
  );
}
