const MODE_KEY = "employee_view_mode";
const COLS_KEY = "employee_view_columns";

// "grid" | "list" — default "grid" (card più piccole, più per riga)
export function getEmployeeViewMode() {
  return localStorage.getItem(MODE_KEY) || "grid";
}

export function setEmployeeViewMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
}

// 2 | 3 colonne base su telefono, solo rilevante in modalità "grid"
export function getEmployeeViewColumns() {
  const n = parseInt(localStorage.getItem(COLS_KEY), 10);
  return n === 3 ? 3 : 2;
}

export function setEmployeeViewColumns(columns) {
  localStorage.setItem(COLS_KEY, String(columns));
}
