export type AboutSection = {
  id: string
  title: string
  paragraphs: string[]
}

export type AboutContent = {
  eyebrow: string
  title: string
  subtitle: string
  sections: AboutSection[]
  ctaTitle: string
  ctaBody: string
  ctaButton: string
}

const ABOUT: Record<string, AboutContent> = {
  en: {
    eyebrow: 'Company',
    title: 'About Runlabs42',
    subtitle:
      'We help teams and creators turn ideas into production-ready web experiences using AI, specifications, and an integrated editor.',
    sections: [
      {
        id: 'mission',
        title: 'Our mission',
        paragraphs: [
          'Runlabs42 exists to make professional web development accessible without sacrificing structure or quality. We combine Spec-Driven Development with a visual editor, live preview, and AI assistance so you can plan, build, and iterate in one place.',
          'Whether you are prototyping a landing page or shipping a full product, the goal is the same: less friction between intent and working code.',
        ],
      },
      {
        id: 'product',
        title: 'What we offer',
        paragraphs: [
          'An AI-native editor with chat, file tree, and preview; Spec-Kit workflows (constitution, spec, plan, tasks, implement); a marketplace to share and discover projects; and integrations with Supabase, GitHub, and Vercel when you are ready to deploy.',
          'Credits and subscription plans keep usage predictable for individuals and teams.',
        ],
      },
      {
        id: 'values',
        title: 'How we work',
        paragraphs: [
          'Transparency in pricing and data handling, with clear legal policies and user control over account data.',
          'Pragmatic AI: models assist you, but you stay in control of specs, code, and what gets published.',
          'Continuous improvement of the editor, marketplace, and developer experience based on real usage.',
        ],
      },
    ],
    ctaTitle: 'Ready to build?',
    ctaBody: 'Start free in the editor or explore plans and credits on the pricing page.',
    ctaButton: 'Get started',
  },
  es: {
    eyebrow: 'Empresa',
    title: 'Acerca de Runlabs42',
    subtitle:
      'Ayudamos a equipos y creadores a convertir ideas en experiencias web listas para producción con IA, especificaciones y un editor integrado.',
    sections: [
      {
        id: 'mission',
        title: 'Nuestra misión',
        paragraphs: [
          'Runlabs42 existe para que el desarrollo web profesional sea accesible sin renunciar a la estructura ni a la calidad. Combinamos Spec-Driven Development con un editor visual, vista previa en vivo y asistencia de IA para planificar, construir e iterar en un solo lugar.',
          'Tanto si prototipas una landing como si lanzas un producto completo, el objetivo es el mismo: menos fricción entre la intención y el código que funciona.',
        ],
      },
      {
        id: 'product',
        title: 'Qué ofrecemos',
        paragraphs: [
          'Un editor nativo de IA con chat, árbol de archivos y preview; flujos Spec-Kit (constitution, spec, plan, tasks, implement); un marketplace para compartir y descubrir proyectos; e integraciones con Supabase, GitHub y Vercel cuando quieras desplegar.',
          'Los créditos y planes de suscripción hacen predecible el uso para particulares y equipos.',
        ],
      },
      {
        id: 'values',
        title: 'Cómo trabajamos',
        paragraphs: [
          'Transparencia en precios y tratamiento de datos, con políticas legales claras y control del usuario sobre su cuenta.',
          'IA pragmática: los modelos te asisten, pero tú controlas las specs, el código y lo que se publica.',
          'Mejora continua del editor, el marketplace y la experiencia de desarrollo según el uso real.',
        ],
      },
    ],
    ctaTitle: '¿Listo para construir?',
    ctaBody: 'Empieza gratis en el editor o explora planes y créditos en la página de precios.',
    ctaButton: 'Empezar',
  },
  fr: {
    eyebrow: 'Entreprise',
    title: 'À propos de Runlabs42',
    subtitle:
      'Nous aidons les équipes et les créateurs à transformer leurs idées en expériences web prêtes pour la production grâce à l’IA, aux spécifications et à un éditeur intégré.',
    sections: [
      {
        id: 'mission',
        title: 'Notre mission',
        paragraphs: [
          'Runlabs42 rend le développement web professionnel accessible sans sacrifier la structure ni la qualité. Nous combinons le Spec-Driven Development avec un éditeur visuel, un aperçu en direct et l’assistance IA pour planifier, construire et itérer au même endroit.',
        ],
      },
      {
        id: 'product',
        title: 'Ce que nous proposons',
        paragraphs: [
          'Un éditeur IA avec chat, arborescence de fichiers et aperçu ; des workflows Spec-Kit ; une marketplace ; et des intégrations Supabase, GitHub et Vercel pour le déploiement.',
        ],
      },
      {
        id: 'values',
        title: 'Notre approche',
        paragraphs: [
          'Transparence sur les tarifs et les données, avec des politiques légales claires.',
          'IA au service de l’utilisateur : vous gardez le contrôle des specs et du code publié.',
        ],
      },
    ],
    ctaTitle: 'Prêt à construire ?',
    ctaBody: 'Commencez gratuitement dans l’éditeur ou consultez nos tarifs.',
    ctaButton: 'Commencer',
  },
  de: {
    eyebrow: 'Unternehmen',
    title: 'Über Runlabs42',
    subtitle:
      'Wir helfen Teams und Creators, Ideen mit KI, Spezifikationen und einem integrierten Editor in produktionsreife Web-Erlebnisse zu verwandeln.',
    sections: [
      {
        id: 'mission',
        title: 'Unsere Mission',
        paragraphs: [
          'Runlabs42 macht professionelle Webentwicklung zugänglich, ohne Struktur oder Qualität zu opfern. Spec-Driven Development, visueller Editor, Live-Vorschau und KI-Unterstützung vereinen Planung, Build und Iteration an einem Ort.',
        ],
      },
      {
        id: 'product',
        title: 'Unser Angebot',
        paragraphs: [
          'KI-nativer Editor mit Chat, Dateibaum und Vorschau; Spec-Kit-Workflows; Marketplace; Integrationen mit Supabase, GitHub und Vercel.',
        ],
      },
      {
        id: 'values',
        title: 'Unsere Arbeitsweise',
        paragraphs: [
          'Transparente Preise und klare Datenschutzrichtlinien.',
          'Pragmatische KI: Sie behalten die Kontrolle über Specs, Code und Veröffentlichungen.',
        ],
      },
    ],
    ctaTitle: 'Bereit loszulegen?',
    ctaBody: 'Starten Sie kostenlos im Editor oder sehen Sie sich die Preise an.',
    ctaButton: 'Loslegen',
  },
  nl: {
    eyebrow: 'Bedrijf',
    title: 'Over Runlabs42',
    subtitle:
      'We helpen teams en makers ideeën om te zetten in productieklare webervaringen met AI, specificaties en een geïntegreerde editor.',
    sections: [
      {
        id: 'mission',
        title: 'Onze missie',
        paragraphs: [
          'Runlabs42 maakt professionele webontwikkeling toegankelijk zonder structuur of kwaliteit op te offeren. Spec-Driven Development, visuele editor, live preview en AI-assistentie op één plek.',
        ],
      },
      {
        id: 'product',
        title: 'Wat we bieden',
        paragraphs: [
          'AI-editor met chat, bestandsstructuur en preview; Spec-Kit-workflows; marketplace; integraties met Supabase, GitHub en Vercel.',
        ],
      },
      {
        id: 'values',
        title: 'Hoe we werken',
        paragraphs: [
          'Transparante prijzen en duidelijk databeleid.',
          'Pragmatische AI: jij houdt controle over specs, code en publicaties.',
        ],
      },
    ],
    ctaTitle: 'Klaar om te bouwen?',
    ctaBody: 'Begin gratis in de editor of bekijk onze prijzen.',
    ctaButton: 'Aan de slag',
  },
  it: {
    eyebrow: 'Azienda',
    title: 'Informazioni su Runlabs42',
    subtitle:
      'Aiutiamo team e creator a trasformare le idee in esperienze web pronte per la produzione con IA, specifiche e un editor integrato.',
    sections: [
      {
        id: 'mission',
        title: 'La nostra missione',
        paragraphs: [
          'Runlabs42 rende lo sviluppo web professionale accessibile senza sacrificare struttura e qualità. Spec-Driven Development, editor visuale, anteprima live e assistenza IA in un unico posto.',
        ],
      },
      {
        id: 'product',
        title: 'Cosa offriamo',
        paragraphs: [
          'Editor IA con chat, albero file e anteprima; workflow Spec-Kit; marketplace; integrazioni con Supabase, GitHub e Vercel.',
        ],
      },
      {
        id: 'values',
        title: 'Come lavoriamo',
        paragraphs: [
          'Prezzi trasparenti e policy legali chiare.',
          'IA pragmatica: mantieni il controllo su spec, codice e pubblicazioni.',
        ],
      },
    ],
    ctaTitle: 'Pronto a costruire?',
    ctaBody: 'Inizia gratis nell’editor o scopri i piani e i crediti.',
    ctaButton: 'Inizia',
  },
}

export function getAboutContent(lang: string): AboutContent {
  return (ABOUT[lang] ?? ABOUT.en) as AboutContent
}
