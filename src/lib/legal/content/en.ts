import type { LegalContentMap } from '@/lib/legal/types'

const COMPANY = 'Runlabs42'
const CONTACT = 'https://www.runlabs42.com/contact'

export const enLegal: LegalContentMap = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use, and protect your personal data.',
    lastUpdated: '18 May 2026',
    acceptanceNotice:
      `By accessing or using ${COMPANY}, you confirm that you have read and understood this Privacy Policy and accept its terms. The service is provided within the limits described herein; except where applicable law requires otherwise, ${COMPANY} and its operators shall not be liable beyond those mandatory limits.`,
    sections: [
      {
        id: 'controller',
        title: '1. Data controller',
        paragraphs: [
          `The data controller responsible for processing personal data in connection with ${COMPANY} is the entity operating the platform at runlabs42.com (hereinafter "${COMPANY}" or "we").`,
          `For privacy-related requests, contact us via ${CONTACT} or the address indicated on our website.`,
        ],
      },
      {
        id: 'scope',
        title: '2. Scope',
        paragraphs: [
          'This policy applies to personal data processed when you visit our website, create an account (via GitHub or Google OAuth), use the editor, marketplace, billing features, or contact support.',
          'It does not apply to third-party websites or services linked from our platform; those are governed by their own policies.',
        ],
      },
      {
        id: 'data',
        title: '3. Data we collect',
        paragraphs: [
          'Account data: name, email address, profile image, and identifiers supplied by your OAuth provider (GitHub or Google).',
          'Usage data: projects, specifications, generated code, chat prompts, credit consumption, integration settings, and technical logs (IP address, browser type, timestamps) necessary for security and operation.',
          'Payment data: billing events are processed by Stripe; we do not store full card numbers on our servers.',
          'Communications: information you send through contact forms or support channels.',
        ],
      },
      {
        id: 'bases',
        title: '4. Legal bases (EEA/UK)',
        paragraphs: [
          'Contract performance: to provide the service you request, including account management and project storage.',
          'Legitimate interests: security, fraud prevention, service improvement, and analytics in aggregated form, balanced against your rights.',
          'Consent: where required for non-essential cookies or optional marketing communications.',
          'Legal obligation: when we must retain or disclose data to comply with law.',
        ],
      },
      {
        id: 'use',
        title: '5. How we use your data',
        paragraphs: [
          'We use personal data to operate the platform, authenticate users, persist projects, process AI requests, manage credits and subscriptions, respond to inquiries, and comply with legal obligations.',
          'AI features may send prompts and project context to third-party model providers (e.g. Google Gemini) under their terms; you should not submit unlawful or highly sensitive personal data unless you accept that risk.',
        ],
      },
      {
        id: 'processors',
        title: '6. Processors and transfers',
        paragraphs: [
          'We rely on trusted subprocessors, including hosting and database providers (e.g. Supabase), payment processing (Stripe), and AI infrastructure providers. A current list is available on request.',
          'Data may be processed in the European Union, the United States, or other countries where our providers operate. Where required, we use appropriate safeguards such as Standard Contractual Clauses.',
        ],
      },
      {
        id: 'retention',
        title: '7. Retention',
        paragraphs: [
          'We retain account and project data while your account is active and for a reasonable period thereafter to allow recovery and comply with law.',
          'Logs and billing records are kept for periods required by tax, accounting, and security obligations, then deleted or anonymised.',
        ],
      },
      {
        id: 'rights',
        title: '8. Your rights',
        paragraphs: [
          'Depending on your location, you may have rights to access, rectify, erase, restrict, port, or object to processing of your personal data, and to withdraw consent where processing is consent-based.',
          'You may lodge a complaint with your local data protection authority. To exercise rights, contact us via the contact page; we will respond within applicable statutory deadlines.',
        ],
      },
      {
        id: 'security',
        title: '9. Security',
        paragraphs: [
          'We implement technical and organisational measures appropriate to the risk, including encryption in transit, access controls, and separation of customer data where applicable.',
          'No method of transmission or storage is completely secure; you use the service at your own risk regarding unauthorised access beyond our reasonable controls.',
        ],
      },
      {
        id: 'liability',
        title: '10. Limitation of liability',
        paragraphs: [
          `To the fullest extent permitted by applicable law, ${COMPANY} shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill arising from use of the service or disclosure of personal data except where such limitation is prohibited.`,
          'Nothing in this policy limits liability for death or personal injury caused by negligence, fraud, or other liability that cannot be excluded by law.',
        ],
      },
      {
        id: 'changes',
        title: '11. Changes',
        paragraphs: [
          'We may update this policy from time to time. The "Last updated" date at the top indicates the latest version. Material changes may be notified via the website or email where appropriate.',
          'Continued use after changes constitutes acceptance of the updated policy unless applicable law requires explicit consent.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    subtitle: 'Information about cookies and similar technologies on our website.',
    lastUpdated: '18 May 2026',
    acceptanceNotice:
      `By continuing to browse or use ${COMPANY} after viewing the cookie notice, you accept this Cookie Policy and our use of cookies as described below, except for non-essential cookies where we request your consent. We are not responsible for third-party sites or services outside our control.`,
    sections: [
      {
        id: 'what',
        title: '1. What are cookies?',
        paragraphs: [
          'Cookies are small text files stored on your device when you visit a website. Similar technologies include local storage, session storage, and pixels.',
          'They help the site function, remember preferences, and understand how the service is used.',
        ],
      },
      {
        id: 'types',
        title: '2. Cookies we use',
        paragraphs: [
          'Strictly necessary: authentication session (Supabase), security, load balancing, and demo-mode flags in development. These are required for the service to work.',
          'Preferences: language (sk.lang), theme (sk.theme), editor layout, Spec-Kit toggle, and cookie consent status (sk.cookie_consent).',
          'Functional: may include integration OAuth state cookies during Vercel or similar connection flows.',
        ],
      },
      {
        id: 'third',
        title: '3. Third-party cookies',
        paragraphs: [
          'OAuth providers (Google, GitHub) may set cookies when you sign in through their pages.',
          'Stripe may use cookies during checkout. Analytics or support tools, if enabled, may set their own cookies subject to their policies.',
        ],
      },
      {
        id: 'manage',
        title: '4. Managing cookies',
        paragraphs: [
          'You can control cookies through your browser settings (block, delete, or alert). Blocking strictly necessary cookies may prevent login or core features.',
          'You can withdraw consent for non-essential cookies at any time by clearing site data or using our cookie banner where available.',
        ],
      },
      {
        id: 'duration',
        title: '5. Retention periods',
        paragraphs: [
          'Session cookies expire when you close the browser. Persistent cookies may last up to 12 months unless deleted earlier.',
          'Consent records may be stored locally for the same period to avoid repeated prompts.',
        ],
      },
      {
        id: 'legal',
        title: '6. Legal basis',
        paragraphs: [
          'Necessary cookies are used based on legitimate interest and contract performance. Preference and optional cookies rely on consent where required by law (e.g. ePrivacy Directive / GDPR).',
        ],
      },
      {
        id: 'liability',
        title: '7. Disclaimer',
        paragraphs: [
          `Information in this policy is provided for transparency. ${COMPANY} is not liable for cookie practices of third parties or for damages arising from your cookie choices beyond mandatory legal limits.`,
        ],
      },
      {
        id: 'changes',
        title: '8. Updates',
        paragraphs: [
          'We may update this Cookie Policy periodically. Please review this page regularly. The date above shows when it was last revised.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Rules governing access to and use of the platform.',
    lastUpdated: '18 May 2026',
    acceptanceNotice:
      `By creating an account, clicking "Accept", or using ${COMPANY}, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the service. The platform is provided "as is"; liability is limited as set out below.`,
    sections: [
      {
        id: 'service',
        title: '1. The service',
        paragraphs: [
          `${COMPANY} is a browser-based platform for AI-assisted software specification, code generation, project management, and related features, including optional marketplace and deployment integrations.`,
          'We may modify, suspend, or discontinue features with reasonable notice where practicable.',
        ],
      },
      {
        id: 'account',
        title: '2. Accounts',
        paragraphs: [
          'You must register using GitHub or Google OAuth and provide accurate information. You are responsible for safeguarding access to your OAuth accounts and all activity under your Runlabs42 account.',
          'You must be at least 16 years old (or the minimum age required in your jurisdiction) to use the service.',
        ],
      },
      {
        id: 'acceptable',
        title: '3. Acceptable use',
        paragraphs: [
          'You may not use the service for unlawful purposes, to infringe intellectual property, to distribute malware, to harass others, or to attempt unauthorised access to systems or data.',
          'You are responsible for prompts, code, and content you generate or publish, including compliance with licences of third-party components.',
        ],
      },
      {
        id: 'ai',
        title: '4. AI-generated content',
        paragraphs: [
          'Outputs from AI models may be inaccurate, incomplete, or unsuitable for production. You must review, test, and validate all generated code and specifications before use.',
          `${COMPANY} does not warrant that AI outputs are error-free, non-infringing, or fit for any particular purpose. You assume full responsibility for deployment and consequences of use.`,
        ],
      },
      {
        id: 'ip',
        title: '5. Intellectual property',
        paragraphs: [
          'We retain rights in the platform, brand, and underlying technology. Subject to these Terms, you retain rights in your projects and content you create, to the extent permitted by law and third-party licences.',
          'You grant us a limited licence to host, process, and display your content solely to operate and improve the service.',
        ],
      },
      {
        id: 'payment',
        title: '6. Payments and credits',
        paragraphs: [
          'Paid plans and credit packs are billed through Stripe under the prices shown at purchase. Fees are non-refundable except where required by law or explicitly stated.',
          'Credits may expire or renew according to plan rules published on the pricing page. We may change pricing with notice.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Disclaimer of warranties',
        paragraphs: [
          `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.`,
        ],
      },
      {
        id: 'liability',
        title: '8. Limitation of liability',
        paragraphs: [
          `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${COMPANY} AND ITS AFFILIATES, DIRECTORS, EMPLOYEES, AND SUPPLIERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.`,
          `OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) AMOUNTS YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) FIFTY US DOLLARS (USD 50), EXCEPT WHERE LIABILITY CANNOT BE LIMITED BY LAW.`,
        ],
      },
      {
        id: 'indemnity',
        title: '9. Indemnification',
        paragraphs: [
          'You agree to indemnify and hold harmless Runlabs42 from claims arising from your content, your breach of these Terms, or your violation of law or third-party rights, to the extent permitted by applicable law.',
        ],
      },
      {
        id: 'termination',
        title: '10. Termination',
        paragraphs: [
          'You may stop using the service at any time. We may suspend or terminate access for breach of these Terms, legal requirements, or risk to the platform or other users.',
          'Upon termination, provisions that by nature should survive (liability limits, indemnity, governing law) remain in effect.',
        ],
      },
      {
        id: 'law',
        title: '11. Governing law',
        paragraphs: [
          'These Terms are governed by the laws of Spain, without regard to conflict-of-law principles, unless mandatory consumer protections in your country require otherwise.',
          'Disputes shall be submitted to the courts of Spain, unless EU consumer rules grant you the right to bring proceedings in your country of residence.',
        ],
      },
      {
        id: 'changes',
        title: '12. Changes',
        paragraphs: [
          'We may revise these Terms. We will post the updated version on this page and update the date above. Continued use after changes constitutes acceptance unless prohibited by law.',
        ],
      },
    ],
  },
}
