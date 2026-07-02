# Timbry (contaore)

Timbry è un'applicazione web per la gestione delle presenze/timbrature aziendali
(orari di ingresso/uscita, ferie, permessi, turni, badge NFC, lettori hardware).
È pensata per PMI italiane: un'azienda ("company") ha dipendenti, dispositivi
lettore badge (basati su Arduino/ESP), turni di lavoro e richieste (ferie,
permessi, giustificazioni) che un titolare/admin approva.

Repo reale: `contaore/` (la cartella con questo nome dentro la root del repository
Git). I due PDF nella root (`Timbry_Guida.pdf`, `Timbry_Tutorial.pdf`) sono
materiale utente, non codice.

## Struttura

```
contaore/
├── backend/     Server API — Node.js + Fastify
├── frontend/    App web — React + Vite
├── arduino/     Firmware del lettore badge (produzione)
├── arduino-test/ Firmware di test/collaudo per il lettore
└── docs/        Documenti legali/contrattuali generati (PDF/HTML)
```

## Backend (`contaore/backend`)

- Framework: **Fastify** (non Express). Entry point: `server.js`.
- Avvio locale: `npm install && npm run dev` (porta da `PORT` env, default 3000).
- Autenticazione: **JWT custom** firmato con `JWT_SECRET`, non Supabase Auth.
  I middleware di autenticazione sono in `middleware/auth.js`
  (`authenticate`, `authenticateOwner`, `authenticateSuperadmin`,
  `authenticateDipendente`, `authenticateWithInactivity`,
  `requirePermission`/`requireAnyPermission` per i permessi granulari admin).
- Ruoli utente: `superadmin` (gestione piattaforma), `owner` (titolare azienda),
  `admin` (accesso limitato/granulare via colonna `permissions` su
  `user_account`), `dipendente` (portale self-service).
- Database: **Supabase (Postgres)**, client in `services/supabase.js`.
  Le query usano l'SDK `@supabase/supabase-js`, non un ORM.
- Route (`routes/*.js`), ognuna registrata in `server.js`: `export.js`
  (export PDF/Excel), `presenze.js`, `hardware.js` (endpoint chiamati dal
  lettore badge fisico), `tags.js`, `employees.js`, `devices.js`, `auth.js`,
  `user-settings.js`, `scan.js`, `admin.js`, `dipendente.js` (portale
  dipendente), `ferie.js`, `requests.js`, `pause.js`, `notifiche.js`,
  `billing.js` (Stripe).
- Servizi esterni: **Stripe** (abbonamenti, `services/stripe.js`),
  **Resend** (email, `services/email.js`), **Twilio** (SMS/WhatsApp per 2FA,
  `services/twilio.js`), **Sentry** (error tracking).
- **Migration database**: NON vengono eseguite leggendo i file `.sql`
  numerati dalla cartella `migrations/`. Il vero schema applicato all'avvio
  del server è scritto **direttamente dentro** `migrations/runMigrations.js`
  (ogni istruzione è idempotente: `CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`). I file `000_...sql` → `010_...sql` sono un
  **archivio storico/di consultazione**, utile per capire l'evoluzione dello
  schema ma non eseguito da nessuno script.
  - `migrations/SCHEMA_COMPLETO.sql` — vista unificata e leggibile di tutto
    lo schema atteso (unione ordinata dei file 000→010), solo di consultazione.
  - `migrations/check_schema.sql` — script diagnostico di sola lettura da
    eseguire manualmente in Supabase Studio: confronta lo schema atteso con
    quello effettivamente presente nel database e segnala con ✅/❌ tabelle,
    colonne o la funzione `exec()` mancanti.

## Frontend (`contaore/frontend`)

- Framework: **React 19 + Vite**, routing con `react-router-dom`.
- Avvio locale: `npm install && npm run dev`. Build produzione: `npm run build`.
- Entry point/router: `src/main.jsx`. Pagine in `src/pages/*.jsx`,
  componenti condivisi in `src/components/*.jsx`.
- Autenticazione: token JWT salvato in `localStorage` (`token`, `user`),
  letto da `src/api.js` e verificato da `src/ProtectedRoute.jsx`. Non usa
  Supabase lato client.
- Layout owner (titolare/admin): `components/OwnerLayout.jsx` avvolge le
  pagine sotto `/employees`, `/badges`, `/notifications`, `/readers`, ecc. e
  gestisce centralmente il tema chiaro/scuro (legge/scrive
  `localStorage.getItem("theme")` una sola volta per tutta la sezione).
- Portale dipendente: pagine separate (`DipendenteDashboard.jsx`,
  bottom nav dedicata `DipendenteBottomNav.jsx`).
- Superadmin: `pages/admin.jsx`, route standalone non sotto `OwnerLayout`,
  con proprio toggle tema indipendente.
- Deploy: Vercel (`vercel.json`).

## Firmware (`contaore/arduino`, `contaore/arduino-test`)

Sketch per il lettore badge NFC fisico (display + lettura tag). `arduino/`
è la versione di produzione, `arduino-test/` una versione di collaudo.
Comunicano con gli endpoint in `backend/routes/hardware.js` e `scan.js`.

## Note per chi lavora su questo repo

- Branch di lavoro tipico creato da Claude Code: `claude/...` — vedi la
  cronologia commit per lo stile dei messaggi (italiano, sintetico).
- Non esiste una audit-log/validazione centralizzata lato backend: la
  validazione degli input è fatta a mano in ciascuna route (non tramite uno
  schema condiviso).
- Il calcolo ore/turni/tolleranze (straordinari, ritardi, tolleranza in
  difetto) è distribuito tra `utils/timeHelpers.js` e le singole route
  (`presenze.js`, `dipendente.js`, `export.js`).
