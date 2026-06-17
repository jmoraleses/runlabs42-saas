'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useApp, Icon, MarketingShell } from '@/components/app/shell'
import { getLegalDocument, LEGAL_ROUTES } from '@/lib/legal/getLegalDocument'
function docIdFromPath(path) {
  if (path === '/legal/privacy') return 'privacy'
  if (path === '/legal/cookies') return 'cookies'
  if (path === '/legal/terms') return 'terms'
  return null
}

const RELATED = {
  privacy: ['cookies', 'terms'],
  cookies: ['privacy', 'terms'],
  terms: ['privacy', 'cookies'],
}

export function LegalPage() {
  const { lang, t, navigate } = useApp()
  const pathname = usePathname() || '/'
  const docId = docIdFromPath(pathname)

  const doc = useMemo(() => {
    if (!docId) return null
    return getLegalDocument(docId, lang)
  }, [docId, lang])

  if (!docId || !doc) {
    return (
      <MarketingShell>
        <section className="legal-page">
          <div className="container legal-page-inner">
            <p>{t('legal.notFound')}</p>
          </div>
        </section>
      </MarketingShell>
    )
  }

  const related = RELATED[docId]

  return (
    <MarketingShell>
      <section className="legal-page">
        <div className="legal-page-bg bg-grid" aria-hidden />
        <div className="container legal-page-inner">
          <header className="app-page-header legal-page-header">
            <button
              type="button"
              className="btn btn-ghost btn-sm legal-page-back"
              onClick={() => navigate('/')}
            >
              <Icon.Arrow style={{ transform: 'rotate(180deg)' }} />
              {t('legal.back')}
            </button>
            <p className="eyebrow">{t(`legal.eyebrow.${docId}`)}</p>
            <h1>{doc.title}</h1>
            <p className="app-page-header__lead">{doc.subtitle}</p>
            <p className="legal-page-meta">
              {t('legal.lastUpdated')}: <time dateTime="2026-05-18">{doc.lastUpdated}</time>
            </p>
          </header>

          <aside className="legal-page-notice" role="note">
            <strong>{t('legal.acceptanceLabel')}</strong>
            <p>{doc.acceptanceNotice}</p>
          </aside>

          <article className="legal-page-body">
            {doc.sections.map((section) => (
              <section key={section.id} id={section.id} className="legal-page-section">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </section>
            ))}
          </article>

          <nav className="legal-page-related" aria-label={t('legal.related')}>
            <h3>{t('legal.related')}</h3>
            <ul>
              {related.map((id) => {
                const relatedDoc = getLegalDocument(id, lang)
                return (
                  <li key={id}>
                    <a
                      href={LEGAL_ROUTES[id]}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate(LEGAL_ROUTES[id])
                      }}
                    >
                      {relatedDoc.title}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </section>
    </MarketingShell>
  )
}
