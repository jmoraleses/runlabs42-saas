import type { LegalContentMap } from '@/lib/legal/types'
import { getAppUrl } from '@/lib/env'

const COMPANY = 'Runlabs42'
const CONTACT = `${getAppUrl()}/contact`

export const frLegal: LegalContentMap = {
  privacy: {
    title: 'Politique de confidentialité',
    subtitle: 'Comment nous collectons, utilisons et protégeons vos données personnelles.',
    lastUpdated: '18 mai 2026',
    acceptanceNotice:
      `En accédant ou en utilisant ${COMPANY}, vous confirmez avoir lu et compris cette Politique de confidentialité et en accepter les termes. Le service est fourni dans les limites décrites ci-dessous ; sauf obligation légale contraire, ${COMPANY} et ses opérateurs ne sauraient être tenus responsables au-delà des limites impératives.`,
    sections: [
      {
        id: 'controller',
        title: '1. Responsable du traitement',
        paragraphs: [
          `Le responsable du traitement des données personnelles liées à ${COMPANY} est l'entité exploitant la plateforme (ci-après « ${COMPANY} » ou « nous »).`,
          `Pour toute demande relative à la vie privée, contactez-nous via ${CONTACT} ou l'adresse indiquée sur notre site.`,
        ],
      },
      {
        id: 'scope',
        title: '2. Champ d\'application',
        paragraphs: [
          'Cette politique s\'applique aux données traitées lors de votre visite, de la création d\'un compte (OAuth GitHub ou Google), de l\'utilisation de l\'éditeur, du marketplace, de la facturation ou du support.',
          'Elle ne s\'applique pas aux sites ou services tiers liés depuis notre plateforme, régis par leurs propres politiques.',
        ],
      },
      {
        id: 'data',
        title: '3. Données collectées',
        paragraphs: [
          'Compte : nom, e-mail, photo de profil et identifiants fournis par votre fournisseur OAuth (GitHub ou Google).',
          'Usage : projets, spécifications, code généré, messages de chat, consommation de crédits, paramètres d\'intégration et journaux techniques (adresse IP, navigateur, horodatages) nécessaires à la sécurité et au fonctionnement.',
          'Paiement : les transactions sont traitées par Stripe ; nous ne stockons pas les numéros complets de carte.',
          'Communications : informations envoyées via nos formulaires ou canaux de support.',
        ],
      },
      {
        id: 'bases',
        title: '4. Bases juridiques (EEE/Royaume-Uni)',
        paragraphs: [
          'Exécution du contrat : fournir le service demandé, y compris la gestion du compte et le stockage des projets.',
          'Intérêt légitime : sécurité, prévention de la fraude, amélioration du service et analyses agrégées, en équilibre avec vos droits.',
          'Consentement : lorsque requis pour les cookies non essentiels ou les communications marketing optionnelles.',
          'Obligation légale : lorsque nous devons conserver ou divulguer des données pour respecter la loi.',
        ],
      },
      {
        id: 'use',
        title: '5. Utilisation des données',
        paragraphs: [
          'Nous utilisons les données pour exploiter la plateforme, authentifier les utilisateurs, conserver les projets, traiter les requêtes IA, gérer crédits et abonnements, répondre aux demandes et respecter nos obligations légales.',
          'Les fonctions IA peuvent transmettre des prompts et le contexte du projet à des fournisseurs de modèles (p. ex. Google Gemini) selon leurs conditions ; n\'envoyez pas de données personnelles sensibles ou illicites si vous n\'acceptez pas ce risque.',
        ],
      },
      {
        id: 'processors',
        title: '6. Sous-traitants et transferts',
        paragraphs: [
          'Nous faisons appel à des sous-traitants de confiance, notamment pour l\'hébergement et les bases de données (p. ex. Supabase), les paiements (Stripe) et l\'infrastructure IA. Liste disponible sur demande.',
          'Les données peuvent être traitées dans l\'UE, aux États-Unis ou dans d\'autres pays où opèrent nos prestataires. Le cas échéant, nous appliquons des garanties appropriées, telles que les clauses contractuelles types.',
        ],
      },
      {
        id: 'retention',
        title: '7. Conservation',
        paragraphs: [
          'Nous conservons les données de compte et de projet tant que votre compte est actif, puis pendant une période raisonnable pour la récupération et le respect de la loi.',
          'Les journaux et données de facturation sont conservés selon les obligations fiscales, comptables et de sécurité, puis supprimés ou anonymisés.',
        ],
      },
      {
        id: 'rights',
        title: '8. Vos droits',
        paragraphs: [
          'Selon votre localisation, vous pouvez disposer d\'un droit d\'accès, de rectification, d\'effacement, de limitation, de portabilité ou d\'opposition, et de retrait du consentement lorsque le traitement en est fondé.',
          'Vous pouvez introduire une réclamation auprès de votre autorité de protection des données. Pour exercer vos droits, contactez-nous ; nous répondrons dans les délais légaux.',
        ],
      },
      {
        id: 'security',
        title: '9. Sécurité',
        paragraphs: [
          'Nous mettons en œuvre des mesures techniques et organisationnelles adaptées au risque, notamment le chiffrement en transit, les contrôles d\'accès et la séparation des données clients le cas échéant.',
          'Aucune méthode de transmission ou de stockage n\'est totalement sûre ; vous utilisez le service à vos risques en cas d\'accès non autorisé au-delà de nos contrôles raisonnables.',
        ],
      },
      {
        id: 'liability',
        title: '10. Limitation de responsabilité',
        paragraphs: [
          `Dans toute la mesure permise par la loi applicable, ${COMPANY} ne sera pas responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, ni de la perte de profits, de données ou de clientèle, sauf lorsque une telle limitation est interdite.`,
          'Rien dans cette politique ne limite la responsabilité en cas de décès ou de blessures corporelles par négligence, de fraude ou d\'autres cas non excluables par la loi.',
        ],
      },
      {
        id: 'changes',
        title: '11. Modifications',
        paragraphs: [
          'Nous pouvons mettre à jour cette politique. La date « Dernière mise à jour » indique la version en vigueur. Les changements importants pourront être notifiés sur le site ou par e-mail le cas échéant.',
          'L\'utilisation continue après modification vaut acceptation, sauf si la loi exige un consentement explicite.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Politique relative aux cookies',
    subtitle: 'Informations sur les cookies et technologies similaires sur notre site.',
    lastUpdated: '18 mai 2026',
    acceptanceNotice:
      `En poursuivant la navigation ou l'utilisation de ${COMPANY} après l'avis cookies, vous acceptez cette politique et l'utilisation décrite, sauf pour les cookies non essentiels soumis à votre consentement. Nous ne sommes pas responsables des sites ou services tiers hors de notre contrôle.`,
    sections: [
      {
        id: 'what',
        title: '1. Qu\'est-ce qu\'un cookie ?',
        paragraphs: [
          'Les cookies sont de petits fichiers texte stockés sur votre appareil lors de la visite d\'un site. Les technologies similaires incluent le stockage local, de session et les pixels.',
          'Ils permettent au site de fonctionner, de mémoriser vos préférences et de comprendre l\'usage du service.',
        ],
      },
      {
        id: 'types',
        title: '2. Cookies utilisés',
        paragraphs: [
          'Strictement nécessaires : session d\'authentification (Supabase), sécurité, répartition de charge et indicateurs de mode démo en développement.',
          'Préférences : langue (sk.lang), thème (sk.theme), mise en page de l\'éditeur, bascule Spec-Kit et consentement cookies (sk.cookie_consent).',
          'Fonctionnels : cookies d\'état OAuth lors des connexions Vercel ou similaires.',
        ],
      },
      {
        id: 'third',
        title: '3. Cookies tiers',
        paragraphs: [
          'Les fournisseurs OAuth (Google, GitHub) peuvent déposer des cookies lors de la connexion sur leurs pages.',
          'Stripe peut utiliser des cookies lors du paiement. Les outils d\'analyse ou de support, s\'ils sont activés, peuvent déposer les leurs selon leurs politiques.',
        ],
      },
      {
        id: 'manage',
        title: '4. Gestion des cookies',
        paragraphs: [
          'Vous pouvez les contrôler via les paramètres du navigateur. Bloquer les cookies nécessaires peut empêcher la connexion ou certaines fonctions.',
          'Vous pouvez retirer votre consentement pour les cookies non essentiels en effaçant les données du site ou via notre bandeau cookies.',
        ],
      },
      {
        id: 'duration',
        title: '5. Durées de conservation',
        paragraphs: [
          'Les cookies de session expirent à la fermeture du navigateur. Les cookies persistants peuvent durer jusqu\'à 12 mois sauf suppression anticipée.',
          'Les preuves de consentement peuvent être stockées localement pour la même durée.',
        ],
      },
      {
        id: 'legal',
        title: '6. Base juridique',
        paragraphs: [
          'Les cookies nécessaires reposent sur l\'intérêt légitime et l\'exécution du contrat. Les cookies de préférence ou optionnels requièrent le consentement lorsque la loi l\'exige (directive ePrivacy / RGPD).',
        ],
      },
      {
        id: 'liability',
        title: '7. Clause de non-responsabilité',
        paragraphs: [
          `Les informations de cette politique sont fournies à titre de transparence. ${COMPANY} n'est pas responsable des pratiques cookies des tiers ni des dommages liés à vos choix au-delà des limites légales impératives.`,
        ],
      },
      {
        id: 'changes',
        title: '8. Mises à jour',
        paragraphs: [
          'Nous pouvons mettre à jour cette politique périodiquement. Consultez cette page régulièrement. La date ci-dessus indique la dernière révision.',
        ],
      },
    ],
  },
  terms: {
    title: 'Conditions d\'utilisation',
    subtitle: 'Règles régissant l\'accès et l\'utilisation de la plateforme.',
    lastUpdated: '18 mai 2026',
    acceptanceNotice:
      `En créant un compte, en cliquant sur « Accepter » ou en utilisant ${COMPANY}, vous acceptez ces Conditions et notre Politique de confidentialité. Sinon, n'utilisez pas le service. La plateforme est fournie « en l'état » ; la responsabilité est limitée comme indiqué ci-dessous.`,
    sections: [
      {
        id: 'service',
        title: '1. Le service',
        paragraphs: [
          `${COMPANY} est une plateforme web pour la spécification logicielle assistée par IA, la génération de code, la gestion de projets et des fonctions associées, dont un marketplace et des intégrations de déploiement optionnelles.`,
          'Nous pouvons modifier, suspendre ou interrompre des fonctionnalités avec un préavis raisonnable lorsque cela est possible.',
        ],
      },
      {
        id: 'account',
        title: '2. Comptes',
        paragraphs: [
          'Vous devez vous inscrire via OAuth GitHub ou Google et fournir des informations exactes. Vous êtes responsable de la sécurité de vos comptes OAuth et de toute activité sur votre compte Runlabs42.',
          'Vous devez avoir au moins 16 ans (ou l\'âge minimum requis dans votre juridiction) pour utiliser le service.',
        ],
      },
      {
        id: 'acceptable',
        title: '3. Usage acceptable',
        paragraphs: [
          'Vous ne devez pas utiliser le service à des fins illégales, pour porter atteinte à la propriété intellectuelle, diffuser des logiciels malveillants, harceler autrui ou tenter un accès non autorisé.',
          'Vous êtes responsable de vos prompts, code et contenus, y compris le respect des licences tierces.',
        ],
      },
      {
        id: 'ai',
        title: '4. Contenu généré par IA',
        paragraphs: [
          'Les sorties des modèles IA peuvent être inexactes, incomplètes ou inadaptées à la production. Vous devez examiner, tester et valider tout code et spécification avant usage.',
          `${COMPANY} ne garantit pas que les sorties IA sont exemptes d'erreurs, non contrefaisantes ou adaptées à un usage particulier. Vous assumez l'entière responsabilité du déploiement et des conséquences.`,
        ],
      },
      {
        id: 'ip',
        title: '5. Propriété intellectuelle',
        paragraphs: [
          'Nous conservons les droits sur la plateforme, la marque et la technologie sous-jacente. Sous réserve de ces Conditions, vous conservez vos droits sur vos projets et contenus, dans la mesure permise par la loi.',
          'Vous nous accordez une licence limitée pour héberger, traiter et afficher votre contenu uniquement pour exploiter et améliorer le service.',
        ],
      },
      {
        id: 'payment',
        title: '6. Paiements et crédits',
        paragraphs: [
          'Les offres payantes sont facturées via Stripe selon les prix affichés. Les frais ne sont pas remboursables sauf obligation légale ou mention contraire.',
          'Les crédits peuvent expirer ou se renouveler selon les règles publiées sur la page tarifs. Nous pouvons modifier les prix avec préavis.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Exclusion de garanties',
        paragraphs: [
          `LE SERVICE EST FOURNI « EN L'ÉTAT » ET « SELON DISPONIBILITÉ », SANS GARANTIE D'AUCUNE SORTE, EXPRESSE, IMPLICITE OU LÉGALE, Y COMPRIS QUALITÉ MARCHANDE, ADÉQUATION À UN USAGE PARTICULIER ET NON-CONTREFAÇON.`,
        ],
      },
      {
        id: 'liability',
        title: '8. Limitation de responsabilité',
        paragraphs: [
          `DANS LA LIMITE MAXIMALE PERMISE PAR LA LOI, ${COMPANY} ET SES AFFILIÉS, DIRIGEANTS, EMPLOYÉS ET FOURNISSEURS NE SERONT PAS RESPONSABLES DES DOMMAGES INDIRECTS, ACCESSOIRES, SPÉCIAUX, CONSÉCUTIFS OU PUNITIFS, NI DE TOUTE PERTE DE PROFITS, DE DONNÉES OU DE CLIENTÈLE.`,
          `NOTRE RESPONSABILITÉ TOTALE NE DÉPASSERA PAS LE PLUS ÉLEVÉ ENTRE (A) LES MONTANTS PAYÉS AU COURS DES DOUZE MOIS PRÉCÉDANT LA RÉCLAMATION OU (B) CINQUANTE DOLLARS US (50 USD), SAUF LORSQUE LA LOI INTERDIT CETTE LIMITATION.`,
        ],
      },
      {
        id: 'indemnity',
        title: '9. Indemnisation',
        paragraphs: [
          'Vous acceptez d\'indemniser et de dégager de toute responsabilité Runlabs42 pour toute réclamation liée à votre contenu, à votre violation de ces Conditions ou de la loi ou des droits de tiers, dans la mesure permise par la loi.',
        ],
      },
      {
        id: 'termination',
        title: '10. Résiliation',
        paragraphs: [
          'Vous pouvez cesser d\'utiliser le service à tout moment. Nous pouvons suspendre ou résilier l\'accès en cas de violation des Conditions, d\'exigence légale ou de risque pour la plateforme ou d\'autres utilisateurs.',
          'À la résiliation, les clauses devant survivre (limitation de responsabilité, indemnisation, droit applicable) restent en vigueur.',
        ],
      },
      {
        id: 'law',
        title: '11. Droit applicable',
        paragraphs: [
          'Ces Conditions sont régies par le droit espagnol, sans égard aux règles de conflit de lois, sauf protections impératives des consommateurs dans votre pays.',
          'Les litiges relèvent des tribunaux espagnols, sauf droit pour les consommateurs de l\'UE d\'agir devant les tribunaux de leur pays de résidence.',
        ],
      },
      {
        id: 'changes',
        title: '12. Modifications',
        paragraphs: [
          'Nous pouvons réviser ces Conditions. La version mise à jour sera publiée sur cette page avec la date actualisée. L\'utilisation continue vaut acceptation sauf interdiction légale.',
        ],
      },
    ],
  },
}
