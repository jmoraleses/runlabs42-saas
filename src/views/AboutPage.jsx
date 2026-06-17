'use client'

import { useMemo } from 'react'
import { useApp, Icon, MarketingShell } from '@/components/app/shell'
import { getAboutContent } from '@/lib/about/content'
import { openStudio } from '@/lib/projects/openStudio'

export function AboutPage() {
  const { lang, t, navigate } = useApp()
  const content = useMemo(() => getAboutContent(lang), [lang])

  return (
    <MarketingShell>
      <section className="legal-page about-page">
        <div className="legal-page-bg bg-grid" aria-hidden />
        <div className="container legal-page-inner">
          <header className="app-page-header legal-page-header">
            <button
              type="button"
              className="btn btn-ghost btn-sm legal-page-back"
              onClick={() => navigate('/')}
            >
              <Icon.Arrow style={{ transform: 'rotate(180deg)' }} />
              {t('about.back')}
            </button>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p className="app-page-header__lead">{content.subtitle}</p>
          </header>

          <article className="legal-page-body">
            {content.sections.map((section) => (
              <section key={section.id} id={section.id} className="legal-page-section">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </section>
            ))}
          </article>

          <aside className="about-page-cta">
            <h2>{content.ctaTitle}</h2>
            <p>{content.ctaBody}</p>
            <div className="about-page-cta-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openStudio(navigate, lang === 'en' ? 'en' : 'es')}
              >
                {content.ctaButton}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/pricing')}>
                {t('nav.pricing')}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </MarketingShell>
  )
}
