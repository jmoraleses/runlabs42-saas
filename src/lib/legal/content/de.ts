import type { LegalContentMap } from '@/lib/legal/types'
import { getAppUrl } from '@/lib/env'

const COMPANY = 'Runlabs42'
const CONTACT = `${getAppUrl()}/contact`

export const deLegal: LegalContentMap = {
  privacy: {
    title: 'Datenschutzerklärung',
    subtitle: 'Wie wir personenbezogene Daten erheben, nutzen und schützen.',
    lastUpdated: '18. Mai 2026',
    acceptanceNotice:
      `Durch den Zugriff auf oder die Nutzung von ${COMPANY} bestätigen Sie, dass Sie diese Datenschutzerklärung gelesen und verstanden haben und ihren Bedingungen zustimmen. Der Dienst wird innerhalb der hier beschriebenen Grenzen bereitgestellt; soweit gesetzlich zulässig haften ${COMPANY} und seine Betreiber nicht über die zwingenden gesetzlichen Grenzen hinaus.`,
    sections: [
      {
        id: 'controller',
        title: '1. Verantwortlicher',
        paragraphs: [
          `Verantwortlicher für die Verarbeitung personenbezogener Daten im Zusammenhang mit ${COMPANY} ist die betreibende Stelle der Plattform (nachfolgend „${COMPANY}“ oder „wir“).`,
          `Für datenschutzbezogene Anfragen kontaktieren Sie uns über ${CONTACT} oder die auf unserer Website angegebene Adresse.`,
        ],
      },
      {
        id: 'scope',
        title: '2. Geltungsbereich',
        paragraphs: [
          'Diese Erklärung gilt für personenbezogene Daten bei Besuch der Website, Kontoerstellung (GitHub- oder Google-OAuth), Nutzung des Editors, Marketplace, Abrechnung oder Support.',
          'Sie gilt nicht für Websites oder Dienste Dritter, die von unserer Plattform verlinkt sind; diese unterliegen eigenen Richtlinien.',
        ],
      },
      {
        id: 'data',
        title: '3. Erhobene Daten',
        paragraphs: [
          'Kontodaten: Name, E-Mail, Profilbild und vom OAuth-Anbieter (GitHub oder Google) übermittelte Kennungen.',
          'Nutzungsdaten: Projekte, Spezifikationen, generierter Code, Chat-Eingaben, Credit-Verbrauch, Integrationseinstellungen und technische Protokolle (IP, Browser, Zeitstempel) für Sicherheit und Betrieb.',
          'Zahlungsdaten: Abrechnungen über Stripe; vollständige Kartendaten speichern wir nicht.',
          'Kommunikation: Informationen aus Kontaktformularen oder Support-Kanälen.',
        ],
      },
      {
        id: 'bases',
        title: '4. Rechtsgrundlagen (EWR/Vereinigtes Königreich)',
        paragraphs: [
          'Vertragserfüllung: Bereitstellung des angeforderten Dienstes einschließlich Kontoverwaltung und Projektspeicherung.',
          'Berechtigte Interessen: Sicherheit, Betrugsprävention, Serviceverbesserung und aggregierte Analysen unter Abwägung Ihrer Rechte.',
          'Einwilligung: wo für nicht notwendige Cookies oder optionales Marketing erforderlich.',
          'Rechtliche Verpflichtung: wenn wir Daten aufbewahren oder offenlegen müssen.',
        ],
      },
      {
        id: 'use',
        title: '5. Verwendung Ihrer Daten',
        paragraphs: [
          'Wir nutzen personenbezogene Daten zum Betrieb der Plattform, zur Authentifizierung, Projektspeicherung, KI-Anfragen, Credit- und Abonnementverwaltung, Beantwortung von Anfragen und zur Erfüllung gesetzlicher Pflichten.',
          'KI-Funktionen können Prompts und Projektkontext an Modellanbieter (z. B. Google Gemini) übermitteln; übermitteln Sie keine rechtswidrigen oder besonders sensiblen Daten, wenn Sie dieses Risiko nicht akzeptieren.',
        ],
      },
      {
        id: 'processors',
        title: '6. Auftragsverarbeiter und Übermittlungen',
        paragraphs: [
          'Wir setzen vertrauenswürdige Unterauftragsverarbeiter ein, u. a. für Hosting und Datenbanken (z. B. Supabase), Zahlungen (Stripe) und KI-Infrastruktur. Aktuelle Liste auf Anfrage.',
          'Daten können in der EU, den USA oder anderen Ländern verarbeitet werden. Wo erforderlich, nutzen wir geeignete Garantien wie Standardvertragsklauseln.',
        ],
      },
      {
        id: 'retention',
        title: '7. Aufbewahrung',
        paragraphs: [
          'Konto- und Projektdaten werden während der Kontolaufzeit und anschließend für eine angemessene Frist zur Wiederherstellung und Rechtserfüllung aufbewahrt.',
          'Protokolle und Abrechnungsdaten werden gemäß steuerlichen, buchhalterischen und Sicherheitsvorgaben gespeichert und danach gelöscht oder anonymisiert.',
        ],
      },
      {
        id: 'rights',
        title: '8. Ihre Rechte',
        paragraphs: [
          'Je nach Standort haben Sie u. a. Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit oder Widerspruch sowie auf Widerruf einer Einwilligung.',
          'Sie können bei Ihrer Datenschutzbehörde Beschwerde einlegen. Zur Ausübung Ihrer Rechte kontaktieren Sie uns; wir antworten innerhalb der gesetzlichen Fristen.',
        ],
      },
      {
        id: 'security',
        title: '9. Sicherheit',
        paragraphs: [
          'Wir setzen angemessene technische und organisatorische Maßnahmen ein, einschließlich Verschlüsselung bei der Übertragung, Zugriffskontrollen und Trennung von Kundendaten.',
          'Keine Übertragungs- oder Speichermethode ist vollständig sicher; Sie nutzen den Dienst auf eigenes Risiko hinsichtlich unbefugtem Zugriff außerhalb unserer angemessenen Kontrollen.',
        ],
      },
      {
        id: 'liability',
        title: '10. Haftungsbeschränkung',
        paragraphs: [
          `Soweit gesetzlich zulässig haftet ${COMPANY} nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden oder entgangenen Gewinn, Daten- oder Goodwill-Verlust aus der Nutzung oder Offenlegung personenbezogener Daten, sofern eine solche Beschränkung nicht verboten ist.`,
          'Nichts in dieser Erklärung beschränkt die Haftung bei Tod oder Körperverletzung durch Fahrlässigkeit, Betrug oder andere nicht ausschließbare Haftung.',
        ],
      },
      {
        id: 'changes',
        title: '11. Änderungen',
        paragraphs: [
          'Wir können diese Erklärung aktualisieren. Das Datum „Zuletzt aktualisiert“ zeigt die gültige Version. Wesentliche Änderungen können auf der Website oder per E-Mail mitgeteilt werden.',
          'Die fortgesetzte Nutzung nach Änderungen gilt als Zustimmung, sofern das Gesetz keine ausdrückliche Einwilligung verlangt.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie-Richtlinie',
    subtitle: 'Informationen zu Cookies und ähnlichen Technologien auf unserer Website.',
    lastUpdated: '18. Mai 2026',
    acceptanceNotice:
      `Durch weiteres Surfen oder die Nutzung von ${COMPANY} nach dem Cookie-Hinweis akzeptieren Sie diese Cookie-Richtlinie und die beschriebene Verwendung, außer bei nicht notwendigen Cookies, für die wir Ihre Einwilligung einholen. Wir sind nicht verantwortlich für Websites oder Dienste Dritter außerhalb unserer Kontrolle.`,
    sections: [
      {
        id: 'what',
        title: '1. Was sind Cookies?',
        paragraphs: [
          'Cookies sind kleine Textdateien auf Ihrem Gerät beim Besuch einer Website. Ähnliche Technologien umfassen Local Storage, Session Storage und Pixel.',
          'Sie helfen beim Betrieb der Website, beim Merken von Einstellungen und beim Verständnis der Nutzung.',
        ],
      },
      {
        id: 'types',
        title: '2. Von uns verwendete Cookies',
        paragraphs: [
          'Unbedingt erforderlich: Authentifizierungssitzung (Supabase), Sicherheit, Lastverteilung und Demo-Flags in der Entwicklung.',
          'Präferenzen: Sprache (sk.lang), Theme (sk.theme), Editor-Layout, Spec-Kit-Schalter und Cookie-Einwilligung (sk.cookie_consent).',
          'Funktional: ggf. OAuth-Status-Cookies bei Vercel- oder ähnlichen Integrationsflüssen.',
        ],
      },
      {
        id: 'third',
        title: '3. Cookies Dritter',
        paragraphs: [
          'OAuth-Anbieter (Google, GitHub) können beim Anmelden auf ihren Seiten Cookies setzen.',
          'Stripe kann beim Checkout Cookies verwenden. Analyse- oder Support-Tools können eigene Cookies setzen.',
        ],
      },
      {
        id: 'manage',
        title: '4. Cookie-Verwaltung',
        paragraphs: [
          'Sie können Cookies in den Browsereinstellungen steuern. Das Blockieren notwendiger Cookies kann Anmeldung oder Kernfunktionen verhindern.',
          'Sie können die Einwilligung für nicht notwendige Cookies jederzeit widerrufen, indem Sie Website-Daten löschen oder unser Banner nutzen.',
        ],
      },
      {
        id: 'duration',
        title: '5. Speicherdauer',
        paragraphs: [
          'Sitzungscookies enden beim Schließen des Browsers. Persistente Cookies können bis zu 12 Monate gültig sein.',
          'Einwilligungsnachweise können lokal für denselben Zeitraum gespeichert werden.',
        ],
      },
      {
        id: 'legal',
        title: '6. Rechtsgrundlage',
        paragraphs: [
          'Notwendige Cookies basieren auf berechtigtem Interesse und Vertragserfüllung. Präferenz- und optionale Cookies erfordern ggf. Einwilligung (z. B. ePrivacy-Richtlinie / DSGVO).',
        ],
      },
      {
        id: 'liability',
        title: '7. Haftungsausschluss',
        paragraphs: [
          `Die Informationen dienen der Transparenz. ${COMPANY} haftet nicht für Cookie-Praktiken Dritter oder Schäden aus Ihren Cookie-Entscheidungen über zwingende gesetzliche Grenzen hinaus.`,
        ],
      },
      {
        id: 'changes',
        title: '8. Aktualisierungen',
        paragraphs: [
          'Wir können diese Richtlinie regelmäßig aktualisieren. Bitte prüfen Sie diese Seite. Das obige Datum zeigt die letzte Überarbeitung.',
        ],
      },
    ],
  },
  terms: {
    title: 'Nutzungsbedingungen',
    subtitle: 'Regeln für den Zugriff auf und die Nutzung der Plattform.',
    lastUpdated: '18. Mai 2026',
    acceptanceNotice:
      `Mit Kontoerstellung, Klick auf „Akzeptieren“ oder Nutzung von ${COMPANY} stimmen Sie diesen Nutzungsbedingungen und unserer Datenschutzerklärung zu. Andernfalls nutzen Sie den Dienst nicht. Die Plattform wird „wie besehen“ bereitgestellt; die Haftung ist wie unten beschrieben begrenzt.`,
    sections: [
      {
        id: 'service',
        title: '1. Der Dienst',
        paragraphs: [
          `${COMPANY} ist eine browserbasierte Plattform für KI-gestützte Softwarespezifikation, Codegenerierung, Projektverwaltung und verwandte Funktionen, einschließlich optionalem Marketplace und Deployment-Integrationen.`,
          'Wir können Funktionen mit angemessener Vorankündigung ändern, aussetzen oder einstellen.',
        ],
      },
      {
        id: 'account',
        title: '2. Konten',
        paragraphs: [
          'Sie registrieren sich per GitHub- oder Google-OAuth und geben wahrheitsgemäße Angaben an. Sie sind für den Schutz Ihrer OAuth-Konten und aller Aktivitäten unter Ihrem Runlabs42-Konto verantwortlich.',
          'Sie müssen mindestens 16 Jahre alt sein (oder das in Ihrer Rechtsordnung erforderliche Mindestalter).',
        ],
      },
      {
        id: 'acceptable',
        title: '3. Zulässige Nutzung',
        paragraphs: [
          'Sie dürfen den Dienst nicht für rechtswidrige Zwecke, Urheberrechtsverletzungen, Malware, Belästigung oder unbefugten Zugriff nutzen.',
          'Sie sind für Prompts, Code und Inhalte verantwortlich, einschließlich der Einhaltung Drittanbieter-Lizenzen.',
        ],
      },
      {
        id: 'ai',
        title: '4. KI-generierte Inhalte',
        paragraphs: [
          'KI-Ausgaben können ungenau, unvollständig oder für den Produktionseinsatz ungeeignet sein. Sie müssen allen generierten Code und Spezifikationen prüfen, testen und validieren.',
          `${COMPANY} garantiert nicht fehlerfreie, rechtskonforme oder zweckgerechte KI-Ausgaben. Sie tragen die volle Verantwortung für Einsatz und Folgen.`,
        ],
      },
      {
        id: 'ip',
        title: '5. Geistiges Eigentum',
        paragraphs: [
          'Wir behalten Rechte an Plattform, Marke und zugrunde liegender Technologie. Vorbehaltlich dieser Bedingungen behalten Sie Rechte an Ihren Projekten und Inhalten im gesetzlich zulässigen Umfang.',
          'Sie gewähren uns eine beschränkte Lizenz zur Speicherung, Verarbeitung und Anzeige Ihrer Inhalte ausschließlich zum Betrieb und zur Verbesserung des Dienstes.',
        ],
      },
      {
        id: 'payment',
        title: '6. Zahlungen und Credits',
        paragraphs: [
          'Kostenpflichtige Pläne werden über Stripe gemäß den beim Kauf angezeigten Preisen abgerechnet. Gebühren sind nicht erstattungsfähig, sofern gesetzlich nicht anders vorgeschrieben.',
          'Credits können gemäß den auf der Preisseite veröffentlichten Regeln verfallen oder erneuert werden. Preisänderungen mit Vorankündigung sind möglich.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Gewährleistungsausschluss',
        paragraphs: [
          `DER DIENST WIRD „WIE BESEHEN“ UND „NACH VERFÜGBARKEIT“ OHNE JEGLICHE AUSDRÜCKLICHE, STILLSCHWEIGENDE ODER GESETZLICHE GEWÄHRLEISTUNG BEREITGESTELLT, EINSCHLIESSLICH MARKTGÄNGIGKEIT, EIGNUNG FÜR EINEN BESTIMMTEN ZWECK UND NICHTVERLETZUNG.`,
        ],
      },
      {
        id: 'liability',
        title: '8. Haftungsbeschränkung',
        paragraphs: [
          `IM GRÖSSTMÖGLICH GESETZLICH ZULÄSSIGEN UMFANG HAFTEN ${COMPANY} UND VERBUNDENE UNTERNEHMEN, LEITENDE ANGESTELLTE, MITARBEITER UND LIEFERANTEN NICHT FÜR INDIREKTE, ZUFÄLLIGE, BESONDERE, FOLGE- ODER STRAFSCHÄDEN ODER ENTGANGENEN GEWINN, DATEN- ODER GOODWILL-VERLUST.`,
          `UNSERE GESAMTHAFTUNG ÜBERSTEIGT NICHT DEN HÖHEREN BETRAG AUS (A) ZAHLUNGEN IN DEN ZWÖLF MONATEN VOR DER FORDERUNG ODER (B) FÜNFZIG US-DOLLAR (50 USD), SOFERN DIE HAFTUNG NICHT GESETZLICH AUSGESCHLOSSEN WERDEN KANN.`,
        ],
      },
      {
        id: 'indemnity',
        title: '9. Freistellung',
        paragraphs: [
          'Sie stellen Runlabs42 von Ansprüchen frei, die aus Ihren Inhalten, Ihrem Verstoß gegen diese Bedingungen oder gegen Gesetze oder Rechte Dritter entstehen, soweit gesetzlich zulässig.',
        ],
      },
      {
        id: 'termination',
        title: '10. Beendigung',
        paragraphs: [
          'Sie können die Nutzung jederzeit einstellen. Wir können den Zugang bei Verstößen, gesetzlichen Anforderungen oder Risiken für die Plattform oder andere Nutzer sperren oder beenden.',
          'Nach Beendigung bleiben Bestimmungen mit überdauernder Natur (Haftungsgrenzen, Freistellung, anwendbares Recht) wirksam.',
        ],
      },
      {
        id: 'law',
        title: '11. Anwendbares Recht',
        paragraphs: [
          'Diese Bedingungen unterliegen spanischem Recht unter Ausschluss von Kollisionsnormen, sofern zwingende Verbraucherschutzvorschriften in Ihrem Land nicht anderes verlangen.',
          'Streitigkeiten unterliegen den Gerichten Spaniens, sofern EU-Verbraucherrecht nicht das Recht auf Klage im Wohnsitzland gewährt.',
        ],
      },
      {
        id: 'changes',
        title: '12. Änderungen',
        paragraphs: [
          'Wir können diese Bedingungen überarbeiten und auf dieser Seite veröffentlichen. Die fortgesetzte Nutzung gilt als Zustimmung, sofern gesetzlich nicht anders vorgeschrieben.',
        ],
      },
    ],
  },
}
