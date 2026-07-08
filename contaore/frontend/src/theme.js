const KEY = "theme";

// "light" | "dark" | "auto" — default "auto" quando non ancora impostato
export function getThemePref() {
  return localStorage.getItem(KEY) || "auto";
}

export function setThemePref(pref) {
  localStorage.setItem(KEY, pref);
  applyTheme();
}

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function resolveIsDark(pref = getThemePref()) {
  return pref === "dark" || (pref === "auto" && systemPrefersDark());
}

export function applyTheme() {
  document.documentElement.classList.toggle("dark", resolveIsDark());
}

let listenerAttached = false;

// Applica subito il tema e, una sola volta per l'intera app, resta in ascolto
// dei cambi di tema del sistema per aggiornare live quando la preferenza è "auto".
export function initTheme() {
  applyTheme();
  if (listenerAttached || !window.matchMedia) return;
  listenerAttached = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePref() === "auto") applyTheme();
  });
}
