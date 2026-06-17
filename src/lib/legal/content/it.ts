import type { LegalContentMap } from '@/lib/legal/types'
import { getAppUrl } from '@/lib/env'

const COMPANY = 'Runlabs42'
const CONTACT = `${getAppUrl()}/contact`

export const itLegal: LegalContentMap = {
  privacy: {
    title: 'Informativa sulla privacy',
    subtitle: 'Come raccogliamo, utilizziamo e proteggiamo i dati personali.',
    lastUpdated: '18 maggio 2026',
    acceptanceNotice:
      `Accedendo o utilizzando ${COMPANY}, confermi di aver letto e compreso la presente Informativa sulla privacy e di accettarne i termini. Il servizio è fornito nei limiti qui descritti; salvo obblighi di legge, ${COMPANY} e i suoi operatori non rispondono oltre i limiti legalmente obbligatori.`,
    sections: [
      {
        id: 'controller',
        title: '1. Titolare del trattamento',
        paragraphs: [
          `Il titolare del trattamento dei dati personali in relazione a ${COMPANY} è l'entità che gestisce la piattaforma (di seguito «${COMPANY}» o «noi»).`,
          `Per richieste sulla privacy, contattaci tramite ${CONTACT} o l'indirizzo indicato sul sito.`,
        ],
      },
      {
        id: 'scope',
        title: '2. Ambito di applicazione',
        paragraphs: [
          'La presente informativa si applica ai dati trattati quando visiti il sito, crei un account (OAuth GitHub o Google), usi l\'editor, il marketplace, la fatturazione o il supporto.',
          'Non si applica a siti o servizi di terzi collegati dalla piattaforma, regolati dalle rispettive policy.',
        ],
      },
      {
        id: 'data',
        title: '3. Dati che raccogliamo',
        paragraphs: [
          'Dati account: nome, email, immagine del profilo e identificatori forniti dal provider OAuth (GitHub o Google).',
          'Dati di utilizzo: progetti, specifiche, codice generato, messaggi chat, consumo crediti, impostazioni integrazioni e log tecnici (IP, browser, timestamp) per sicurezza e funzionamento.',
          'Dati di pagamento: la fatturazione è gestita da Stripe; non conserviamo numeri completi di carta.',
          'Comunicazioni: informazioni inviate tramite moduli di contatto o canali di supporto.',
        ],
      },
      {
        id: 'bases',
        title: '4. Basi giuridiche (SEE/Regno Unito)',
        paragraphs: [
          'Esecuzione del contratto: per fornire il servizio richiesto, inclusa gestione account e archiviazione progetti.',
          'Interesse legittimo: sicurezza, prevenzione frodi, miglioramento del servizio e analisi aggregate, bilanciate con i tuoi diritti.',
          'Consenso: ove richiesto per cookie non essenziali o comunicazioni marketing facoltative.',
          'Obbligo di legge: quando dobbiamo conservare o comunicare dati per conformità normativa.',
        ],
      },
      {
        id: 'use',
        title: '5. Uso dei dati',
        paragraphs: [
          'Utilizziamo i dati personali per gestire la piattaforma, autenticare utenti, conservare progetti, elaborare richieste IA, gestire crediti e abbonamenti, rispondere alle richieste e adempiere obblighi legali.',
          'Le funzioni IA possono inviare prompt e contesto del progetto a fornitori di modelli (es. Google Gemini) secondo i loro termini; non inviare dati personali sensibili o illeciti se non accetti tale rischio.',
        ],
      },
      {
        id: 'processors',
        title: '6. Responsabili del trattamento e trasferimenti',
        paragraphs: [
          'Ci avvaliamo di sub-responsabili affidabili, tra cui hosting e database (es. Supabase), pagamenti (Stripe) e infrastruttura IA. Elenco aggiornato su richiesta.',
          'I dati possono essere trattati nell\'UE, negli USA o in altri paesi dove operano i fornitori. Ove richiesto, adottiamo garanzie adeguate come le Clausole Contrattuali Standard.',
        ],
      },
      {
        id: 'retention',
        title: '7. Conservazione',
        paragraphs: [
          'Conserviamo dati di account e progetto finché l\'account è attivo e per un periodo ragionevole successivo per recupero e conformità legale.',
          'Log e dati di fatturazione sono conservati per i periodi richiesti da obblighi fiscali, contabili e di sicurezza, poi cancellati o anonimizzati.',
        ],
      },
      {
        id: 'rights',
        title: '8. I tuoi diritti',
        paragraphs: [
          'A seconda della tua ubicazione, puoi avere diritto di accesso, rettifica, cancellazione, limitazione, portabilità o opposizione, e di revocare il consenso ove il trattamento si basi su di esso.',
          'Puoi presentare reclamo all\'autorità di protezione dei dati competente. Per esercitare i diritti, contattaci; risponderemo nei termini di legge.',
        ],
      },
      {
        id: 'security',
        title: '9. Sicurezza',
        paragraphs: [
          'Adottiamo misure tecniche e organizzative adeguate al rischio, inclusa crittografia in transito, controlli di accesso e separazione dei dati clienti ove applicabile.',
          'Nessun metodo di trasmissione o archiviazione è totalmente sicuro; usi il servizio a tuo rischio per accessi non autorizzati oltre i nostri controlli ragionevoli.',
        ],
      },
      {
        id: 'liability',
        title: '10. Limitazione di responsabilità',
        paragraphs: [
          `Nella misura massima consentita dalla legge, ${COMPANY} non è responsabile per danni indiretti, incidentali, speciali, consequenziali o punitivi, né per perdita di profitti, dati o avviamento derivanti dall'uso del servizio o dalla divulgazione di dati personali, salvo divieto di legge.`,
          'Nulla in questa informativa limita la responsabilità per morte o lesioni personali per negligenza, frode o altre ipotesi non escludibili per legge.',
        ],
      },
      {
        id: 'changes',
        title: '11. Modifiche',
        paragraphs: [
          'Possiamo aggiornare periodicamente questa informativa. La data «Ultimo aggiornamento» indica la versione vigente. Modifiche sostanziali possono essere comunicate sul sito o via email.',
          'L\'uso continuato dopo le modifiche costituisce accettazione, salvo obbligo di consenso esplicito per legge.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Informativa sui cookie',
    subtitle: 'Informazioni su cookie e tecnologie simili sul nostro sito.',
    lastUpdated: '18 maggio 2026',
    acceptanceNotice:
      `Continuando a navigare o utilizzando ${COMPANY} dopo l'avviso cookie, accetti la presente informativa e l'uso descritto, salvo cookie non essenziali per i quali richiediamo il consenso. Non siamo responsabili di siti o servizi di terzi fuori dal nostro controllo.`,
    sections: [
      {
        id: 'what',
        title: '1. Cosa sono i cookie?',
        paragraphs: [
          'I cookie sono piccoli file di testo memorizzati sul dispositivo quando visiti un sito. Tecnologie simili includono local storage, session storage e pixel.',
          'Consentono il funzionamento del sito, la memorizzazione delle preferenze e la comprensione dell\'utilizzo del servizio.',
        ],
      },
      {
        id: 'types',
        title: '2. Cookie che utilizziamo',
        paragraphs: [
          'Strettamente necessari: sessione di autenticazione (Supabase), sicurezza, bilanciamento del carico e flag demo in sviluppo.',
          'Preferenze: lingua (sk.lang), tema (sk.theme), layout editor, interruttore Spec-Kit e consenso cookie (sk.cookie_consent).',
          'Funzionali: cookie di stato OAuth durante integrazioni Vercel o simili.',
        ],
      },
      {
        id: 'third',
        title: '3. Cookie di terze parti',
        paragraphs: [
          'I provider OAuth (Google, GitHub) possono impostare cookie durante l\'accesso sulle loro pagine.',
          'Stripe può usare cookie durante il checkout. Strumenti di analisi o supporto, se attivi, possono impostare i propri cookie.',
        ],
      },
      {
        id: 'manage',
        title: '4. Gestione dei cookie',
        paragraphs: [
          'Puoi controllare i cookie dalle impostazioni del browser. Il blocco dei cookie necessari può impedire l\'accesso o funzioni essenziali.',
          'Puoi revocare il consenso per cookie non essenziali cancellando i dati del sito o usando il nostro banner cookie.',
        ],
      },
      {
        id: 'duration',
        title: '5. Durata di conservazione',
        paragraphs: [
          'I cookie di sessione scadono alla chiusura del browser. Quelli persistenti possono durare fino a 12 mesi salvo cancellazione anticipata.',
          'Le prove di consenso possono essere memorizzate localmente per lo stesso periodo.',
        ],
      },
      {
        id: 'legal',
        title: '6. Base giuridica',
        paragraphs: [
          'I cookie necessari si basano su interesse legittimo ed esecuzione del contratto. Cookie di preferenza o opzionali richiedono consenso ove previsto (es. direttiva ePrivacy / GDPR).',
        ],
      },
      {
        id: 'liability',
        title: '7. Esclusione di responsabilità',
        paragraphs: [
          `Le informazioni in questa informativa sono fornite per trasparenza. ${COMPANY} non è responsabile delle pratiche cookie di terzi né di danni derivanti dalle tue scelte oltre i limiti legali obbligatori.`,
        ],
      },
      {
        id: 'changes',
        title: '8. Aggiornamenti',
        paragraphs: [
          'Possiamo aggiornare periodicamente questa informativa. Consulta regolarmente questa pagina. La data sopra indica l\'ultima revisione.',
        ],
      },
    ],
  },
  terms: {
    title: 'Termini di servizio',
    subtitle: 'Regole che disciplinano l\'accesso e l\'uso della piattaforma.',
    lastUpdated: '18 maggio 2026',
    acceptanceNotice:
      `Creando un account, cliccando «Accetta» o utilizzando ${COMPANY}, accetti i presenti Termini di servizio e la nostra Informativa sulla privacy. In caso contrario, non utilizzare il servizio. La piattaforma è fornita «così com'è»; la responsabilità è limitata come indicato di seguito.`,
    sections: [
      {
        id: 'service',
        title: '1. Il servizio',
        paragraphs: [
          `${COMPANY} è una piattaforma basata su browser per specifiche software assistite da IA, generazione di codice, gestione progetti e funzioni correlate, inclusi marketplace e integrazioni di deploy opzionali.`,
          'Possiamo modificare, sospendere o interrompere funzionalità con ragionevole preavviso ove possibile.',
        ],
      },
      {
        id: 'account',
        title: '2. Account',
        paragraphs: [
          'Devi registrarti tramite OAuth GitHub o Google e fornire informazioni accurate. Sei responsabile della sicurezza dei tuoi account OAuth e di ogni attività sul tuo account Runlabs42.',
          'Devi avere almeno 16 anni (o l\'età minima richiesta nella tua giurisdizione) per usare il servizio.',
        ],
      },
      {
        id: 'acceptable',
        title: '3. Uso consentito',
        paragraphs: [
          'Non puoi usare il servizio per scopi illeciti, violare diritti di proprietà intellettuale, distribuire malware, molestare altri o tentare accessi non autorizzati.',
          'Sei responsabile di prompt, codice e contenuti che generi o pubblichi, incluso il rispetto delle licenze di terzi.',
        ],
      },
      {
        id: 'ai',
        title: '4. Contenuti generati dall\'IA',
        paragraphs: [
          'Gli output dei modelli IA possono essere imprecisi, incompleti o inadatti alla produzione. Devi revisionare, testare e validare tutto il codice e le specifiche generate prima dell\'uso.',
          `${COMPANY} non garantisce che gli output IA siano privi di errori, non violino diritti o siano idonei a uno scopo particolare. Assumi la piena responsabilità per il deploy e le conseguenze dell'uso.`,
        ],
      },
      {
        id: 'ip',
        title: '5. Proprietà intellettuale',
        paragraphs: [
          'Conserviamo i diritti sulla piattaforma, sul marchio e sulla tecnologia sottostante. Fatto salvo questi Termini, conservi i diritti sui tuoi progetti e contenuti nei limiti di legge.',
          'Ci concedi una licenza limitata per ospitare, elaborare e mostrare i tuoi contenuti solo per gestire e migliorare il servizio.',
        ],
      },
      {
        id: 'payment',
        title: '6. Pagamenti e crediti',
        paragraphs: [
          'I piani a pagamento sono fatturati tramite Stripe secondo i prezzi mostrati all\'acquisto. Le tariffe non sono rimborsabili salvo obbligo di legge o indicazione esplicita.',
          'I crediti possono scadere o rinnovarsi secondo le regole pubblicate nella pagina prezzi. Possiamo modificare i prezzi con preavviso.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Esclusione di garanzie',
        paragraphs: [
          `IL SERVIZIO È FORNITO «COSÌ COM'È» E «COME DISPONIBILE» SENZA GARANZIE DI ALCUN TIPO, ESPRESSE, IMPLICITE O LEGALI, INCLUSE COMMERCIABILITÀ, IDONEITÀ A UN FINE PARTICOLARE E NON VIOLAZIONE.`,
        ],
      },
      {
        id: 'liability',
        title: '8. Limitazione di responsabilità',
        paragraphs: [
          `NEI LIMITI MASSIMI CONSENTITI DALLA LEGGE, ${COMPANY} E AFFILIATI, DIRIGENTI, DIPENDENTI E FORNITORI NON SONO RESPONSABILI PER DANNI INDIRETTI, INCIDENTALI, SPECIALI, CONSEQUENZIALI O PUNITIVI, NÉ PER PERDITA DI PROFITTI, DATI O AVVIAMENTO DERIVANTI DALL'USO DEL SERVIZIO.`,
          `LA NOSTRA RESPONSABILITÀ TOTALE NON SUPERERÀ IL MAGGIORE TRA (A) GLI IMPORTI PAGATI NEI DODICI MESI PRECEDENTI IL RECLAMO O (B) CINQUANTA DOLLARI USA (USD 50), SALVO DIVIETO DI LEGGE.`,
        ],
      },
      {
        id: 'indemnity',
        title: '9. Manleva',
        paragraphs: [
          'Accetti di manlevare e tenere indenne Runlabs42 da reclami derivanti dai tuoi contenuti, dalla violazione di questi Termini o di leggi o diritti di terzi, nei limiti di legge.',
        ],
      },
      {
        id: 'termination',
        title: '10. Risoluzione',
        paragraphs: [
          'Puoi cessare l\'uso in qualsiasi momento. Possiamo sospendere o terminare l\'accesso per violazione dei Termini, obblighi legali o rischio per la piattaforma o altri utenti.',
          'Alla risoluzione, restano efficaci le clausole che per natura devono sopravvivere (limiti di responsabilità, manleva, legge applicabile).',
        ],
      },
      {
        id: 'law',
        title: '11. Legge applicabile',
        paragraphs: [
          'I presenti Termini sono regolati dalla legge spagnola, senza riguardo alle norme sul conflitto di leggi, salvo tutele imperative dei consumatori nel tuo paese.',
          'Le controversie sono devolute ai tribunali spagnoli, salvo diritto dei consumatori UE di adire i tribunali del paese di residenza.',
        ],
      },
      {
        id: 'changes',
        title: '12. Modifiche',
        paragraphs: [
          'Possiamo revisionare questi Termini e pubblicare la versione aggiornata su questa pagina. L\'uso continuato costituisce accettazione salvo divieto di legge.',
        ],
      },
    ],
  },
}
