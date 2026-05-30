# CLAUDE.md — Timbry Project

## Panoramica Progetto

**Timbry** è un sistema di gestione presenze NFC-based con portale dipendenti e dashboard amministrativa. L'applicazione traccia timbrature di entrata/uscita, gestisce richieste ferie, calcola ore lavorate e straordinari.

### Stack Tecnologico

**Frontend:**
- React 19.2.6 con React Router DOM 7.15.0
- Vite 8.0.12 (build tool)
- Tailwind CSS 4.3.0 (styling)
- Lucide React (icon library)
- Supabase Client (database)

**Backend:**
- Fastify 5.8.5 (web framework)
- Node.js con ES modules (`type: "module"`)
- Supabase (PostgreSQL database)
- JWT per autenticazione
- Bcrypt per password hashing
- PDFKit e XLSX per export

### Architettura

```
contaore/
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/         # Page components (Dashboard, Login, etc.)
│   │   ├── components/    # Reusable components (Navbar, Layout, etc.)
│   │   ├── hooks/         # Custom hooks (useTheme.js)
│   │   ├── lib/           # Libraries (api.js, auth.js)
│   │   ├── main.jsx       # Entry point con routing
│   │   ├── index.css      # Global styles + Tailwind
│   │   └── App.css        # Component-specific styles
│   └── index.html
├── backend/
│   ├── routes/            # API routes (employees.js, auth.js, etc.)
│   ├── middleware/        # Auth middleware
│   ├── services/          # External services (supabase.js, email.js)
│   ├── state/             # Application state management
│   └── server.js          # Fastify server setup
└── CLAUDE.md              # This file
```

---

## Convenzioni di Codice

### 1. JavaScript/React Style

#### Naming Conventions
- **Componenti React**: PascalCase (`Dashboard`, `EmployeeDetails`, `ChangePasswordModal`)
- **File componenti**: PascalCase.jsx (`Dashboard.jsx`, `Login.jsx`)
- **Funzioni/variabili**: camelCase (`loadEmployees`, `showToast`, `handleSubmit`)
- **Costanti**: UPPER_SNAKE_CASE (`API_URL`, `GIORNI_SETTIMANA`)
- **Route handlers**: camelCase con descrizioni chiare

#### File Structure
```javascript
// 1. Imports (React, librerie, componenti locali)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Calendar } from "lucide-react";
import { API_URL } from "../api";

// 2. Helper functions (fuori dal componente)
function formatOre(h) {
  // implementation
}

// 3. Sub-components (se necessari)
function Toast({ message, type, onClose }) {
  // implementation
}

// 4. Main component (export default)
export default function Dashboard() {
  // implementation
}

// 5. Supporting components (se specifici alla pagina)
function Section({ title, icon, employees }) {
  // implementation
}
```

#### State Management
```javascript
// ✅ CORRETTO: useState con nomi descrittivi
const [loading, setLoading] = useState(true);
const [employees, setEmployees] = useState([]);
const [showModal, setShowModal] = useState(false);

// ✅ CORRETTO: localStorage per persistenza utente/token
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
```

#### Async/Await Pattern
```javascript
// ✅ CORRETTO: try/catch/finally con gestione errori
async function loadEmployees() {
  try {
    setLoading(true);
    const response = await fetch(`${API_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) setEmployees(data.employees || []);
  } catch (err) {
    console.log(err);
  } finally {
    setLoading(false);
  }
}
```

### 2. Tailwind CSS Styling

#### Design System

**Colori (CSS Variables):**
```css
/* Light mode */
--bg: #d4d4d4bd;
--sidebar: #ffffff;
--card: rgba(255,255,255,0.72);
--text: #18181b;
--muted: #71717a;
--border: rgba(0,0,0,0.06);

/* Dark mode (.dark class) */
--bg: #09090b;
--sidebar: #111113;
--card: rgba(53, 53, 55, 0.564);
--text: #fafafa;
--muted: #a1a1aa;
--border: rgba(255,255,255,0.06);
```

**Palette Tailwind:**
- Primary BG: `bg-zinc-100 dark:bg-[#0f0f10]`
- Cards: `bg-white dark:bg-[#161618]`
- Borders: `border-zinc-200 dark:border-zinc-800`
- Text: `text-zinc-900 dark:text-zinc-100`
- Muted: `text-zinc-500 dark:text-zinc-400`
- Buttons primari: `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black`

#### Component Patterns

**Card Standard:**
```jsx
<div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
  {/* content */}
</div>
```

**Button Primario:**
```jsx
<button className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium hover:bg-black transition">
  Logout
</button>
```

**Button Secondario:**
```jsx
<button className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-sm font-medium">
  Annulla
</button>
```

**Input Field:**
```jsx
<input
  type="text"
  className="w-full h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
/>
```

**Header Sticky:**
```jsx
<header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
  <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    {/* content */}
  </div>
</header>
```

**Navigation Pills:**
```jsx
<div className="flex gap-3 mb-8 overflow-x-auto pb-1">
  <Link
    to={item.path}
    className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all ${
      isActive
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
        : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
    }`}
  >
    <Icon size={16} />
    {item.title}
  </Link>
</div>
```

**Status Badges:**
```jsx
// Verde (successo/presente)
<span className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 px-3 py-1 rounded-full text-xs font-semibold">
  Presente
</span>

// Rosso (errore/assente)
<span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 px-3 py-1 rounded-full text-xs font-semibold">
  Assente
</span>

// Giallo (pending)
<span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold">
  In attesa
</span>

// Arancione (warning/straordinario)
<span className="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 px-3 py-1 rounded-full text-xs font-semibold">
  Straordinario
</span>
```

#### Responsive Design

**Breakpoints:**
- `xs:` - 475px (large phones) - **CUSTOM BREAKPOINT**
- `sm:` - 640px (phone landscape)
- `md:` - 768px (tablet)
- `lg:` - 1024px (small desktop)
- `xl:` - 1280px (desktop)
- `2xl:` - 1536px (large desktop)

**Custom Breakpoint Setup (index.css):**
```css
@custom-media --xs (min-width: 475px);
@custom-variant xs (@media (--xs));
```

**Mobile-First Approach:**
Tutte le classi sono progettate mobile-first. I breakpoint vengono applicati progressivamente.

**Grid Layouts:**
```jsx
// Stats cards - responsive da 2 colonne (mobile) a 4 (desktop)
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
  {/* cards */}
</div>

// Employee cards - responsive da 1 a 3 colonne
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
  {/* cards */}
</div>

// Mobile-first stats con padding responsivo
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
  {/* stats */}
</div>
```

**Mobile Navigation:**
```jsx
// Horizontal scroll su mobile con edge-to-edge
<div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
  {navItems.map((item) => (
    <Link
      className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${...}`}
    >
      <Icon size={14} className="sm:w-4 sm:h-4" />
      <span className="hidden xs:inline">{item.title}</span>
    </Link>
  ))}
</div>
```

**Responsive Text & Spacing:**
```jsx
// Titoli responsivi
<h1 className="text-base sm:text-lg font-semibold">Timbry</h1>
<h2 className="text-2xl sm:text-3xl font-semibold">Dipendenti</h2>
<p className="text-xs sm:text-sm text-zinc-500">Sottotitolo</p>

// Padding e margin responsivi
<div className="px-4 sm:px-6 py-4 sm:py-8">

// Altezze responsive
<button className="h-9 sm:h-11 px-3 sm:px-5">

// Bordi arrotondati responsivi
<div className="rounded-xl sm:rounded-2xl">
<div className="rounded-2xl sm:rounded-3xl">
```

**Icon Sizing:**
```jsx
// Icons con dimensioni responsive
<Icon size={14} className="sm:w-4 sm:h-4" />
<Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
```

**Conditional Content (Hide/Show):**
```jsx
// Nascondere su mobile, mostrare da sm
<p className="hidden sm:block">Dashboard realtime</p>

// Mostrare solo su mobile
<span className="sm:hidden">Esci</span>

// Mostrare da xs (475px+)
<span className="hidden xs:inline">Password</span>

// Layout responsive
<div className="flex flex-col xs:flex-row xs:justify-between gap-2 xs:gap-0">
```

**Touch-Friendly Elements:**
```jsx
// Aumenta area di tap su mobile con active state
<button className="h-9 sm:h-11 px-3 sm:px-5 active:scale-[0.98] transition">

// Card cliccabili con feedback
<div className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all">
```

**Modal Responsive:**
```jsx
<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
  <div className="w-full max-w-lg bg-white dark:bg-[#161618] rounded-2xl sm:rounded-3xl flex flex-col max-h-[90vh]">
    {/* content */}
  </div>
</div>
```

**Truncate Long Text:**
```jsx
// Previeni overflow di testo lungo
<p className="truncate">{longText}</p>

// Con min-width per flex containers
<div className="min-w-0 flex-1">
  <p className="truncate">{text}</p>
</div>
```

### 3. Dark Mode

#### Implementation Pattern
```javascript
// 1. State management
const [dark, setDark] = useState(false);

// 2. Load saved preference
useEffect(() => {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    setDark(true);
    document.documentElement.classList.add("dark");
  }
}, []);

// 3. Sync theme changes
useEffect(() => {
  if (dark) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}, [dark]);

// 4. Toggle button
<button onClick={() => setDark(prev => !prev)}>
  {dark ? <Sun size={18} /> : <Moon size={18} />}
</button>
```

#### Regole CSS
- Sempre fornire **entrambe** le varianti: `bg-white dark:bg-zinc-900`
- Usare opacity-based colors per dark mode: `dark:bg-green-500/20`
- Transizioni smooth: `transition-colors duration-300`

### 4. Backend (Fastify)

#### Route Structure
```javascript
// routes/employees.js
export default async function routes(fastify) {

  // GET con autenticazione
  fastify.get('/api/employees', {
    preHandler: authenticate
  }, async (request, reply) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('owner_id', request.user.id);

      if (error) throw error;

      return { success: true, employees: data };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}
```

#### Response Format
```javascript
// ✅ CORRETTO: Success response
return { success: true, data: result, message: "Optional message" };

// ✅ CORRETTO: Error response
return reply.status(400).send({
  success: false,
  error: "Error message",
  message: "User-friendly message" // optional
});
```

#### Authentication Middleware
```javascript
// middleware/auth.js
export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}
```

### 5. Database (Supabase)

#### Query Patterns
```javascript
// ✅ CORRETTO: Select con filtri
const { data, error } = await supabase
  .from('employees')
  .select('*')
  .eq('owner_id', ownerId)
  .order('created_at', { ascending: false });

// ✅ CORRETTO: Insert
const { data, error } = await supabase
  .from('employees')
  .insert({ nome, badge_uid, owner_id })
  .select()
  .single();

// ✅ CORRETTO: Update
const { data, error } = await supabase
  .from('employees')
  .update({ nome, cognome })
  .eq('id', employeeId)
  .eq('owner_id', ownerId)
  .select()
  .single();

// ✅ CORRETTO: Delete
const { error } = await supabase
  .from('employees')
  .delete()
  .eq('id', employeeId)
  .eq('owner_id', ownerId);
```

#### Security
- **SEMPRE** filtrare per `owner_id` per multi-tenancy
- **MAI** esporre dati di altri utenti
- Usare `.single()` quando ci aspettiamo un solo risultato

### 6. Routing (React Router)

```javascript
// main.jsx
<BrowserRouter>
  <Routes>
    {/* Public routes */}
    <Route path="/" element={<Login />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* Protected admin routes */}
    <Route path="/admin" element={
      <ProtectedRoute requireRole="superadmin">
        <Admin />
      </ProtectedRoute>
    } />

    {/* Protected owner routes */}
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    } />

    {/* Protected employee routes */}
    <Route path="/portale" element={
      <ProtectedRoute requireRole="dipendente">
        <DipendenteDashboard />
      </ProtectedRoute>
    } />
  </Routes>
</BrowserRouter>
```

### 7. Icons (Lucide React)

**Pattern Importazione:**
```javascript
import {
  LayoutDashboard, Users, CreditCard,
  Radio, Sun, Moon, Download
} from "lucide-react";

// Uso
<Icon size={16} className="text-zinc-400" />
```

**Icons Comuni:**
- `LayoutDashboard` - Dashboard
- `Users` - Dipendenti
- `CreditCard` - Badge
- `Radio` - Lettori NFC
- `Calendar` - Date/turni
- `Clock` - Orari
- `CheckCircle2` - Successo
- `XCircle` - Errore
- `AlertCircle` - Warning
- `Sun` / `Moon` - Theme toggle
- `LogOut` - Logout
- `Lock` - Password

### 8. Toast Notifications

```javascript
// Component pattern
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${
      type === "success"
        ? "bg-green-500 text-white"
        : "bg-red-500 text-white"
    }`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  );
}

// Usage
const [toast, setToast] = useState(null);

function showToast(msg, type = "success") {
  setToast({ message: msg, type });
}

{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
```

### 9. Helpers & Utilities

```javascript
// Formattazione ore (da decimale a ore/minuti)
function formatOre(h) {
  if (!h || h === 0) return "0m";
  const ore = Math.floor(h);
  const min = Math.round((h - ore) * 60);
  if (ore === 0) return `${min}m`;
  if (min === 0) return `${ore}h`;
  return `${ore}h ${min}m`;
}

// Formattazione date italiane
function fmt(date) {
  return new Date(date).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

// Conversione ora a minuti
function timeToMinutes(t) {
  if (!t) return null;
  const parts = t.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}
```

---

## Best Practices

### Performance

1. **Polling Intelligente:**
```javascript
// ✅ CORRETTO: Cleanup degli interval
useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 5000);
  return () => clearInterval(interval); // cleanup
}, []);
```

2. **Lazy Loading:**
```javascript
// Evitare di caricare tutto subito se non necessario
// Usare pagination per liste lunghe
```

### Security

1. **Token Storage:**
```javascript
// ✅ CORRETTO: localStorage per SPA
localStorage.setItem("token", data.token);
localStorage.setItem("user", JSON.stringify(data.user));

// ✅ CORRETTO: Clear on logout
localStorage.removeItem("token");
localStorage.removeItem("user");
// O meglio:
localStorage.clear();
```

2. **API Calls:**
```javascript
// ✅ CORRETTO: Include token in headers
const response = await fetch(`${API_URL}/api/endpoint`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Error Handling

```javascript
// ✅ CORRETTO: User-friendly errors
try {
  const res = await fetch(...);
  const data = await res.json();
  if (!data.success) {
    showToast(data.message || data.error || "Errore", "error");
    return;
  }
  // success handling
} catch (err) {
  console.log(err);
  showToast("Errore di connessione", "error");
}
```

### Accessibility

1. **Buttons:**
```jsx
// ✅ CORRETTO: disabled state
<button disabled={loading} className="... disabled:opacity-50">
  {loading ? "Caricamento..." : "Salva"}
</button>
```

2. **Forms:**
```jsx
// ✅ CORRETTO: required fields
<input type="email" required />
```

### Code Organization

1. **Separate Concerns:**
   - Helper functions → fuori dal componente
   - API calls → funzioni async separate
   - Sub-components → in fondo al file o file separati

2. **Naming:**
   - Event handlers: `handleSubmit`, `handleClick`
   - Load functions: `loadEmployees`, `loadData`
   - State setters: `setLoading`, `setEmployees`

3. **Comments:**
```javascript
// ✅ CORRETTO: Section dividers per leggibilità
// ── THEME ──────────────────────────────────────
useEffect(() => { /* theme logic */ }, []);

// ── LOAD DATA ──────────────────────────────────
async function loadData() { /* ... */ }

// ══════════ TAB: STORICO ══════════
{tab === "storico" && (
  <div>...</div>
)}
```

---

## Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3000
```

### Backend (.env)
```bash
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## Common Patterns

### Modal Component Structure
```jsx
<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
  <div className="w-full max-w-lg bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col max-h-[90vh]">

    {/* Header */}
    <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
      <h2 className="text-xl font-bold">Title</h2>
      <button onClick={onClose}>
        <X size={16} />
      </button>
    </div>

    {/* Content (scrollable) */}
    <div className="overflow-y-auto p-6">
      {/* content */}
    </div>

    {/* Footer */}
    <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
      <button>Save</button>
    </div>

  </div>
</div>
```

### Collapsible Sections
```jsx
const [isOpen, setIsOpen] = useState(false);

<button onClick={() => setIsOpen(!isOpen)}>
  <span>Section Title</span>
  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
</button>

{isOpen && (
  <div>
    {/* collapsed content */}
  </div>
)}
```

### Conditional Rendering
```jsx
// ✅ CORRETTO: Loading state
{loading && <p>Caricamento...</p>}

// ✅ CORRETTO: Empty state
{!loading && items.length === 0 && (
  <div className="text-center py-16 text-zinc-400">
    Nessun elemento
  </div>
)}

// ✅ CORRETTO: Content
{!loading && items.length > 0 && (
  <div>
    {items.map(item => <Item key={item.id} {...item} />)}
  </div>
)}
```

---

## Testing & Development

### Running the Project

**Frontend:**
```bash
cd contaore/frontend
npm install
npm run dev    # http://localhost:5173
npm run build  # production build
```

**Backend:**
```bash
cd contaore/backend
npm install
npm run dev    # http://localhost:3000
```

### Build for Production
```bash
# Frontend
cd contaore/frontend
npm run build  # → dist/

# Backend (no build needed, it's Node.js)
cd contaore/backend
npm start
```

---

## Ruoli Utente

### Gerarchia
1. **superadmin** - Accesso completo, gestione multi-tenant
2. **owner** - Proprietario aziendale, dashboard admin
3. **dipendente** - Portale dipendente, visualizzazione presenze personali

### Redirect dopo Login
```javascript
if (data.user.role === "superadmin") {
  window.location.href = "/admin";
} else if (data.user.role === "dipendente") {
  window.location.href = "/portale";
} else {
  window.location.href = "/dashboard";
}
```

---

## Export Features

### PDF Export
- Usa PDFKit backend-side
- Genera PDF con presenze dettagliate
- Include statistiche mensili
- Download diretto via blob URL

### Excel Export
- Usa XLSX library
- Formato tabellare per elaborazioni
- Include tutti i campi necessari
- Download diretto via blob URL

---

## Importante

1. **SEMPRE** testare dark mode quando si aggiungono nuovi componenti
2. **SEMPRE** considerare responsive design (mobile-first approach)
3. **MAI** hardcodare valori di configurazione (usare .env)
4. **SEMPRE** gestire stati di loading/error nei componenti
5. **MAI** esporre token JWT nel codice client-side oltre localStorage
6. **SEMPRE** validare input lato backend oltre che frontend
7. **SEMPRE** usare `owner_id` per query multi-tenant
8. **SEMPRE** fare cleanup di interval/timeout in useEffect

---

## Contatti & Supporto

Per domande o chiarimenti su questo progetto, consultare il codice esistente per esempi pratici dei pattern descritti in questo documento.

**Ultima revisione:** 2026-05-30
