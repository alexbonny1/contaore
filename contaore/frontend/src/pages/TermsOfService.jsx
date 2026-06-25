import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0f0f10] py-12 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="mb-8">
          <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">← Torna al login</Link>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Termini di Servizio</h1>
        <p className="text-sm text-zinc-500 mb-8">Ultimo aggiornamento: gennaio 2025</p>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">1. Accettazione dei Termini</h2>
            <p>Utilizzando Timbry ("il Servizio"), il titolare dell'azienda ("Cliente") accetta i presenti Termini di Servizio. Se non si accettano questi termini, non è consentito utilizzare il Servizio. Timbry è riservato a soggetti che agiscono nell'esercizio di un'attività d'impresa, arti o professioni.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">2. Descrizione del Servizio</h2>
            <p>Timbry è una piattaforma SaaS (Software as a Service) per la gestione delle presenze del personale tramite badge NFC. Il Servizio comprende:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Registrazione e gestione delle timbrature tramite badge NFC</li>
              <li>Gestione di dipendenti, turni, ferie e giustificazioni</li>
              <li>Generazione di report e export dati in formato PDF ed Excel</li>
              <li>Portale dipendente per la visualizzazione delle proprie presenze</li>
              <li>Notifiche via email, SMS e WhatsApp</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">3. Registrazione e Account</h2>
            <p>Per accedere al Servizio è necessario disporre di un account creato da Timbry. Il Cliente è responsabile della riservatezza delle credenziali di accesso e di tutte le attività svolte mediante il proprio account. Il Cliente si impegna a notificare immediatamente Timbry di qualsiasi uso non autorizzato.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">4. Obblighi del Cliente</h2>
            <p>Il Cliente si impegna a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Fornire informazioni accurate e aggiornate</li>
              <li>Utilizzare il Servizio in conformità alle leggi applicabili, incluso il D.Lgs. 196/2003 e il GDPR</li>
              <li>Informare e ottenere il consenso dei propri dipendenti per il trattamento dei dati di presenza in conformità alla normativa vigente</li>
              <li>Non cedere, rivendere o sublicenziare il Servizio a terzi</li>
              <li>Non tentare di accedere a sistemi o dati di altri utenti</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">5. Dati e Privacy</h2>
            <p>Il trattamento dei dati personali avviene in conformità alla nostra <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link> e al GDPR (Regolamento UE 2016/679). Il Cliente agisce in qualità di Titolare del trattamento per i dati dei propri dipendenti; Timbry agisce in qualità di Responsabile del trattamento secondo quanto previsto nell'apposito Accordo di Trattamento dei Dati (DPA).</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">6. Disponibilità del Servizio</h2>
            <p>Timbry si impegna a garantire la disponibilità del Servizio, ma non fornisce garanzie di uptime al 100%. Il Servizio può essere temporaneamente sospeso per manutenzione programmata o per cause di forza maggiore. Timbry non è responsabile per eventuali interruzioni o malfunzionamenti derivanti da cause esterne al proprio controllo.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">7. Limitazione di Responsabilità</h2>
            <p>Nella misura massima consentita dalla legge applicabile, Timbry non è responsabile per danni indiretti, incidentali, speciali o consequenziali derivanti dall'utilizzo o dall'impossibilità di utilizzo del Servizio. La responsabilità complessiva di Timbry nei confronti del Cliente non potrà in nessun caso superare i corrispettivi pagati dal Cliente negli ultimi 12 mesi.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">8. Proprietà Intellettuale</h2>
            <p>Timbry e tutti i suoi componenti (software, design, loghi, contenuti) sono di proprietà esclusiva di Timbry e sono protetti dalle leggi sul diritto d'autore e sulla proprietà intellettuale. I presenti Termini non conferiscono al Cliente alcun diritto sulla proprietà intellettuale di Timbry, ad eccezione della licenza limitata di utilizzo del Servizio.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">9. Modifiche ai Termini</h2>
            <p>Timbry si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche sostanziali saranno comunicate via email con un preavviso di almeno 30 giorni. Il proseguimento dell'utilizzo del Servizio dopo la data di entrata in vigore delle modifiche costituisce accettazione dei nuovi Termini.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">10. Risoluzione</h2>
            <p>Entrambe le parti possono risolvere il contratto con un preavviso di 30 giorni. In caso di violazione materiale dei presenti Termini, Timbry può sospendere o terminare l'accesso al Servizio con effetto immediato.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">11. Legge Applicabile e Foro Competente</h2>
            <p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia derivante dai presenti Termini o dall'utilizzo del Servizio, le parti eleggono il Foro di Milano come foro esclusivo.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">12. Contatti</h2>
            <p>Per qualsiasi domanda relativa ai presenti Termini, contattaci all'indirizzo: <a href="mailto:info@timbry.it" className="text-blue-600 dark:text-blue-400 hover:underline">info@timbry.it</a></p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-4 text-xs text-zinc-400">
          <Link to="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition">Privacy Policy</Link>
          <span>·</span>
          <Link to="/cookie-policy" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition">Cookie Policy</Link>
          <span>·</span>
          <span>© 2025 Timbry</span>
        </div>

      </div>
    </div>
  )
}
