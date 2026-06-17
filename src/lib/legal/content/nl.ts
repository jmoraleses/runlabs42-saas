import type { LegalContentMap } from '@/lib/legal/types'

const COMPANY = 'Runlabs42'
const CONTACT = 'https://www.runlabs42.com/contact'

export const nlLegal: LegalContentMap = {
  privacy: {
    title: 'Privacybeleid',
    subtitle: 'Hoe wij persoonsgegevens verzamelen, gebruiken en beschermen.',
    lastUpdated: '18 mei 2026',
    acceptanceNotice:
      `Door ${COMPANY} te openen of te gebruiken bevestigt u dat u dit privacybeleid hebt gelezen en begrepen en de voorwaarden accepteert. De dienst wordt geleverd binnen de hier beschreven grenzen; voor zover de wet dit toelaat, zijn ${COMPANY} en zijn exploitanten niet aansprakelijk buiten de verplichte wettelijke grenzen.`,
    sections: [
      {
        id: 'controller',
        title: '1. Verwerkingsverantwoordelijke',
        paragraphs: [
          `De verwerkingsverantwoordelijke voor persoonsgegevens in verband met ${COMPANY} is de entiteit die het platform op runlabs42.com exploiteert (hierna «${COMPANY}» of «wij»).`,
          `Voor privacyverzoeken kunt u contact opnemen via ${CONTACT} of het adres op onze website.`,
        ],
      },
      {
        id: 'scope',
        title: '2. Toepassingsgebied',
        paragraphs: [
          'Dit beleid is van toepassing op gegevens die worden verwerkt wanneer u onze site bezoekt, een account aanmaakt (GitHub- of Google-OAuth), de editor, marketplace, facturering of support gebruikt.',
          'Het is niet van toepassing op websites of diensten van derden die vanaf ons platform worden gelinkt.',
        ],
      },
      {
        id: 'data',
        title: '3. Gegevens die wij verzamelen',
        paragraphs: [
          'Accountgegevens: naam, e-mail, profielfoto en identificatoren van uw OAuth-provider (GitHub of Google).',
          'Gebruiksgegevens: projecten, specificaties, gegenereerde code, chatberichten, creditverbruik, integratie-instellingen en technische logs (IP-adres, browser, tijdstempels) voor beveiliging en werking.',
          'Betalingsgegevens: facturatie via Stripe; volledige kaartnummers slaan wij niet op.',
          'Communicatie: informatie die u via contactformulieren of support verstuurt.',
        ],
      },
      {
        id: 'bases',
        title: '4. Rechtsgronden (EER/VK)',
        paragraphs: [
          'Uitvoering van de overeenkomst: om de gevraagde dienst te leveren, inclusief accountbeheer en projectopslag.',
          'Gerechtvaardigd belang: beveiliging, fraudepreventie, serviceverbetering en geaggregeerde analyses, afgewogen tegen uw rechten.',
          'Toestemming: waar vereist voor niet-essentiële cookies of optionele marketing.',
          'Wettelijke verplichting: wanneer wij gegevens moeten bewaren of openbaar maken.',
        ],
      },
      {
        id: 'use',
        title: '5. Gebruik van uw gegevens',
        paragraphs: [
          'Wij gebruiken persoonsgegevens om het platform te exploiteren, gebruikers te authenticeren, projecten op te slaan, AI-verzoeken te verwerken, credits en abonnementen te beheren, vragen te beantwoorden en aan wetten te voldoen.',
          'AI-functies kunnen prompts en projectcontext doorsturen naar modelproviders (bijv. Google Gemini); stuur geen onrechtmatige of zeer gevoelige persoonsgegevens als u dat risico niet accepteert.',
        ],
      },
      {
        id: 'processors',
        title: '6. Verwerkers en doorgiften',
        paragraphs: [
          'Wij maken gebruik van betrouwbare subverwerkers, waaronder hosting en databases (bijv. Supabase), betalingen (Stripe) en AI-infrastructuur. Lijst op verzoek beschikbaar.',
          'Gegevens kunnen in de EU, de VS of andere landen worden verwerkt. Waar nodig passen wij passende waarborgen toe, zoals standaardcontractbepalingen.',
        ],
      },
      {
        id: 'retention',
        title: '7. Bewaartermijnen',
        paragraphs: [
          'Wij bewaren account- en projectgegevens zolang uw account actief is en daarna voor een redelijke periode voor herstel en naleving van de wet.',
          'Logs en facturatiegegevens worden bewaard volgens fiscale, boekhoudkundige en beveiligingsverplichtingen en daarna verwijderd of geanonimiseerd.',
        ],
      },
      {
        id: 'rights',
        title: '8. Uw rechten',
        paragraphs: [
          'Afhankelijk van uw locatie heeft u mogelijk recht op inzage, rectificatie, wissing, beperking, overdraagbaarheid of bezwaar, en op intrekking van toestemming.',
          'U kunt een klacht indienen bij uw toezichthoudende autoriteit. Neem contact met ons op om rechten uit te oefenen; wij reageren binnen de wettelijke termijnen.',
        ],
      },
      {
        id: 'security',
        title: '9. Beveiliging',
        paragraphs: [
          'Wij implementeren passende technische en organisatorische maatregelen, waaronder versleuteling tijdens transport, toegangscontrole en scheiding van klantgegevens.',
          'Geen enkele methode is volledig veilig; u gebruikt de dienst op eigen risico met betrekking tot ongeautoriseerde toegang buiten onze redelijke controles.',
        ],
      },
      {
        id: 'liability',
        title: '10. Beperking van aansprakelijkheid',
        paragraphs: [
          `Voor zover wettelijk toegestaan is ${COMPANY} niet aansprakelijk voor indirecte, incidentele, bijzondere, gevolg- of punitieve schade of verlies van winst, gegevens of goodwill, tenzij een dergelijke beperking verboden is.`,
          'Niets in dit beleid beperkt aansprakelijkheid voor overlijden of persoonlijk letsel door nalatigheid, fraude of andere niet-uitsluitbare aansprakelijkheid.',
        ],
      },
      {
        id: 'changes',
        title: '11. Wijzigingen',
        paragraphs: [
          'Wij kunnen dit beleid bijwerken. De datum «Laatst bijgewerkt» geeft de geldende versie aan. Materiële wijzigingen kunnen via de website of e-mail worden gemeld.',
          'Voortgezet gebruik na wijzigingen geldt als acceptatie, tenzij de wet uitdrukkelijke toestemming vereist.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookiebeleid',
    subtitle: 'Informatie over cookies en vergelijkbare technologieën op onze website.',
    lastUpdated: '18 mei 2026',
    acceptanceNotice:
      `Door verder te browsen of ${COMPANY} te gebruiken na het cookiebericht accepteert u dit cookiebeleid en het hieronder beschreven gebruik, behalve voor niet-essentiële cookies waarvoor wij toestemming vragen. Wij zijn niet verantwoordelijk voor sites of diensten van derden buiten onze controle.`,
    sections: [
      {
        id: 'what',
        title: '1. Wat zijn cookies?',
        paragraphs: [
          'Cookies zijn kleine tekstbestanden op uw apparaat bij een websitebezoek. Vergelijkbare technologieën zijn local storage, session storage en pixels.',
          'Ze helpen de site te laten werken, voorkeuren te onthouden en het gebruik te begrijpen.',
        ],
      },
      {
        id: 'types',
        title: '2. Door ons gebruikte cookies',
        paragraphs: [
          'Strikt noodzakelijk: authenticatiesessie (Supabase), beveiliging, load balancing en demo-vlaggen in ontwikkeling.',
          'Voorkeuren: taal (sk.lang), thema (sk.theme), editorlay-out, Spec-Kit-schakelaar en cookie-toestemming (sk.cookie_consent).',
          'Functioneel: OAuth-statuscookies tijdens Vercel- of vergelijkbare integraties.',
        ],
      },
      {
        id: 'third',
        title: '3. Cookies van derden',
        paragraphs: [
          'OAuth-providers (Google, GitHub) kunnen cookies plaatsen bij aanmelding op hun pagina\'s.',
          'Stripe kan cookies gebruiken bij afrekenen. Analyse- of supporttools kunnen eigen cookies plaatsen volgens hun beleid.',
        ],
      },
      {
        id: 'manage',
        title: '4. Cookies beheren',
        paragraphs: [
          'U kunt cookies beheren via browserinstellingen. Het blokkeren van noodzakelijke cookies kan inloggen of kernfuncties verhinderen.',
          'U kunt toestemming voor niet-essentiële cookies intrekken door sitegegevens te wissen of ons cookiebanner te gebruiken.',
        ],
      },
      {
        id: 'duration',
        title: '5. Bewaartermijnen',
        paragraphs: [
          'Sessiecookies verlopen bij sluiten van de browser. Permanente cookies kunnen tot 12 maanden geldig blijven.',
          'Toestemmingsrecords kunnen lokaal voor dezelfde periode worden opgeslagen.',
        ],
      },
      {
        id: 'legal',
        title: '6. Rechtsgrond',
        paragraphs: [
          'Noodzakelijke cookies zijn gebaseerd op gerechtvaardigd belang en contractuitvoering. Voorkeur- en optionele cookies vereisen toestemming waar de wet dit vereist (bijv. ePrivacy-richtlijn / AVG).',
        ],
      },
      {
        id: 'liability',
        title: '7. Disclaimer',
        paragraphs: [
          `De informatie in dit beleid dient ter transparantie. ${COMPANY} is niet aansprakelijk voor cookiepraktijken van derden of schade door uw keuzes buiten verplichte wettelijke grenzen.`,
        ],
      },
      {
        id: 'changes',
        title: '8. Updates',
        paragraphs: [
          'Wij kunnen dit cookiebeleid periodiek bijwerken. Raadpleeg deze pagina regelmatig. De datum hierboven toont de laatste revisie.',
        ],
      },
    ],
  },
  terms: {
    title: 'Servicevoorwaarden',
    subtitle: 'Regels voor toegang tot en gebruik van het platform.',
    lastUpdated: '18 mei 2026',
    acceptanceNotice:
      `Door een account aan te maken, op «Accepteren» te klikken of ${COMPANY} te gebruiken, gaat u akkoord met deze servicevoorwaarden en ons privacybeleid. Gebruik de dienst anders niet. Het platform wordt geleverd «zoals het is»; aansprakelijkheid is beperkt zoals hieronder.`,
    sections: [
      {
        id: 'service',
        title: '1. De dienst',
        paragraphs: [
          `${COMPANY} is een browsergebaseerd platform voor AI-ondersteunde softwarespecificatie, codegeneratie, projectbeheer en gerelateerde functies, waaronder optionele marketplace en deployment-integraties.`,
          'Wij kunnen functies wijzigen, opschorten of beëindigen met redelijke kennisgeving waar mogelijk.',
        ],
      },
      {
        id: 'account',
        title: '2. Accounts',
        paragraphs: [
          'U registreert via GitHub- of Google-OAuth en verstrekt juiste gegevens. U bent verantwoordelijk voor de beveiliging van uw OAuth-accounts en alle activiteit onder uw Runlabs42-account.',
          'U moet minimaal 16 jaar oud zijn (of de minimumleeftijd in uw rechtsgebied).',
        ],
      },
      {
        id: 'acceptable',
        title: '3. Aanvaardbaar gebruik',
        paragraphs: [
          'U mag de dienst niet gebruiken voor onrechtmatige doeleinden, inbreuk op intellectueel eigendom, malware, intimidatie of ongeautoriseerde toegang.',
          'U bent verantwoordelijk voor prompts, code en inhoud, inclusief naleving van licenties van derden.',
        ],
      },
      {
        id: 'ai',
        title: '4. Door AI gegenereerde inhoud',
        paragraphs: [
          'AI-uitvoer kan onnauwkeurig, onvolledig of ongeschikt voor productie zijn. U moet alle gegenereerde code en specificaties controleren, testen en valideren.',
          `${COMPANY} garandeert niet dat AI-uitvoer foutloos, niet-inbreukmakend of geschikt voor een bepaald doel is. U draagt de volledige verantwoordelijkheid voor inzet en gevolgen.`,
        ],
      },
      {
        id: 'ip',
        title: '5. Intellectueel eigendom',
        paragraphs: [
          'Wij behouden rechten op het platform, merk en onderliggende technologie. Onder deze voorwaarden behoudt u rechten op uw projecten en inhoud voor zover de wet dit toelaat.',
          'U verleent ons een beperkte licentie om uw inhoud te hosten, verwerken en tonen uitsluitend om de dienst te exploiteren en te verbeteren.',
        ],
      },
      {
        id: 'payment',
        title: '6. Betalingen en credits',
        paragraphs: [
          'Betaalde plannen worden via Stripe gefactureerd volgens de getoonde prijzen. Kosten zijn niet terugbetaalbaar behalve waar de wet dit vereist.',
          'Credits kunnen verlopen of vernieuwen volgens de regels op de prijspagina. Wij kunnen prijzen wijzigen met kennisgeving.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Uitsluiting van garanties',
        paragraphs: [
          `DE DIENST WORDT GELEVERD «ZOALS HET IS» EN «ZOALS BESCHIKBAAR» ZONDER ENIGE GARANTIE, EXPLICIET, IMPLICIET OF WETTELIJK, INCLUSIEF VERKOOPBAARHEID, GESCHIKTHEID VOOR EEN BEPAALD DOEL EN NIET-INBREUK.`,
        ],
      },
      {
        id: 'liability',
        title: '8. Beperking van aansprakelijkheid',
        paragraphs: [
          `VOOR ZOVER WETTELIJK TOEGESTAAN ZIJN ${COMPANY} EN GELIEERDE ENTITEITEN, DIRECTEUREN, MEDEWERKERS EN LEVERANCIERS NIET AANSPRAKELIJK VOOR INDIRECTE, INCIDENTELE, BIJZONDERE, GEVOLG- OF PUNITIEVE SCHADE OF VERLIES VAN WINST, GEGEVENS OF GOODWILL.`,
          `ONZE TOTALE AANSPRAKELIJKHEID OVERSTIJGT NIET HET HOOGSTE VAN (A) BEDRAGEN DIE U IN DE TWAALF MAANDEN VOOR DE CLAIM HEBT BETAALD OF (B) VIJFTIG US-DOLLAR (USD 50), BEHALVE WAAR AANSPRAKELIJKHEID NIET KAN WORDEN BEPERKT.`,
        ],
      },
      {
        id: 'indemnity',
        title: '9. Vrijwaring',
        paragraphs: [
          'U vrijwaart Runlabs42 van claims voortvloeiend uit uw inhoud, schending van deze voorwaarden of wetten of rechten van derden, voor zover wettelijk toegestaan.',
        ],
      },
      {
        id: 'termination',
        title: '10. Beëindiging',
        paragraphs: [
          'U kunt de dienst op elk moment stoppen. Wij kunnen toegang opschorten of beëindigen bij schending, wettelijke vereisten of risico voor het platform of andere gebruikers.',
          'Na beëindiging blijven bepalingen van overblijvende aard van kracht (aansprakelijkheidsbeperking, vrijwaring, toepasselijk recht).',
        ],
      },
      {
        id: 'law',
        title: '11. Toepasselijk recht',
        paragraphs: [
          'Deze voorwaarden worden beheerst door Spaans recht, zonder regels over wetsconflicten, tenzij dwingend consumentenrecht in uw land anders vereist.',
          'Geschillen worden voorgelegd aan de Spaanse rechtbanken, tenzij EU-consumentenrecht u het recht geeft te procederen in uw woonland.',
        ],
      },
      {
        id: 'changes',
        title: '12. Wijzigingen',
        paragraphs: [
          'Wij kunnen deze voorwaarden herzien en op deze pagina publiceren. Voortgezet gebruik geldt als acceptatie tenzij de wet dit verbiedt.',
        ],
      },
    ],
  },
}
