'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useApp, Icon, MarketingShell, FRAMEWORKS } from '@/components/app/shell'
import { useUser } from '@/hooks/useUser'
import {
  canUseGithubImport,
  createDemoProject,
  enableDemo,
  hasRealAccount,
  isDemoActive,
  saveDemoProjectSpec,
  shouldUseDemoData,
} from '@/lib/auth/demo'
import { setPendingEditorSession } from '@/lib/landing/pendingEditorPrompt'
import {
  compressAttachmentForDesignReference,
  DESIGN_REFERENCE_MAX_PENDING_DATAURL,
} from '@/lib/design/designReferenceImages.client'
import { markStudioProjectJustCreated, openStudio } from '@/lib/projects/openStudio'
import {
  consumePendingGithubImport,
  hasPendingGithubImport,
  setPendingGithubImport,
} from '@/lib/landing/pendingGithubImport'
import { WebStudioPromptBar } from '@/components/editor/webStudio/WebStudioPromptBar'
import { GithubImportModal } from '@/components/editor/GithubImportModal'
import {
  discardPrimedGithubTab,
  ensureGithubConnected,
  GITHUB_OAUTH_NOT_CONFIGURED,
  GITHUB_SIGN_IN_REQUIRED,
  primeGithubOAuthTab,
} from '@/lib/auth/connectGithub'
import { useAIModel } from '@/hooks/useAIModel'
import { apiFetch } from '@/lib/api/client'

// Runlabs42 — Landing page

function Hero() {
  const { t, navigate } = useApp();
  const { user, profile, loading: userLoading, isAuthenticated } = useUser();
  const {
    modelChoice,
    setModelChoice,
    categoryChoices,
    categoryModels,
    selectionMode,
    setCategoryModelChoice,
    options: modelOptions,
  } = useAIModel();
  const promptBarRef = useRef(null);

  const chips = [
    t('hero.chip.businessPage'),
    t('hero.chip.portfolio'),
    t('hero.chip.pricingPage'),
    t('hero.chip.contactForm'),
  ];

  const [submitting, setSubmitting] = useState(false);
  const [githubImportOpen, setGithubImportOpen] = useState(false);
  const [githubProjectId, setGithubProjectId] = useState(null);
  const canGithubImport = canUseGithubImport(user, profile);

  async function submitPrompt(prompt, opts) {
    const text = prompt.trim() || t('ed.design.promptPlaceholder').slice(0, 40);
    const rawImages = opts?.images ?? [];
    const images = await Promise.all(
      rawImages.map(async (img, index) => {
        if (img.url?.trim()) {
          return {
            id: `hero-img-${Date.now()}-${index}`,
            mimeType: img.mimeType,
            dataUrl: '',
            url: img.url.trim(),
            name: `image-${index + 1}`,
          };
        }
        const data = typeof img.data === 'string' ? img.data : '';
        const dataUrl = data.startsWith('data:')
          ? data
          : data
            ? `data:${img.mimeType};base64,${data}`
            : '';
        const att = {
          id: `hero-img-${Date.now()}-${index}`,
          mimeType: img.mimeType,
          dataUrl,
          previewUrl: dataUrl,
          name: `image-${index + 1}`,
        };
        const shrunk = dataUrl
          ? await compressAttachmentForDesignReference(
              att,
              DESIGN_REFERENCE_MAX_PENDING_DATAURL,
            )
          : att;
        return {
          id: shrunk.id,
          mimeType: shrunk.mimeType,
          dataUrl: shrunk.dataUrl,
          url: img.url,
          name: shrunk.name,
        };
      }),
    );
    setPendingEditorSession({
      text,
      images,
      autoGenerate: true,
      brief: opts?.brief,
      generateImages: opts?.generateImages === true,
      imageModelId: opts?.imageModelId,
    });
    if (!isAuthenticated) {
      navigate(`/auth/signin?next=${encodeURIComponent('/studio')}`);
      return;
    }
    setSubmitting(true);
    try {
      const spec = `# Spec\n\n${text}\n`;
      const name = text.slice(0, 80);
      let project;
      if (isDemoActive() || shouldUseDemoData(profile)) {
        enableDemo();
        project = createDemoProject(name, 'next');
        saveDemoProjectSpec(project.id, spec);
      } else {
        ({ project } = await apiFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            name,
            framework: 'next',
            initialSpec: spec,
          }),
        }));
      }
      markStudioProjectJustCreated(project.id);
      navigate(`/studio?project=${encodeURIComponent(project.id)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('projects.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  const runGithubImport = useCallback(async () => {
    if (!canUseGithubImport(user, profile)) return

    setSubmitting(true)
    try {
      await ensureGithubConnected()

      const name = 'Proyecto desde GitHub'
      const { project } = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          framework: 'next',
          initialSpec: `# Spec\n\nImportado desde GitHub.\n`,
        }),
      })
      setGithubProjectId(project.id)
      setGithubImportOpen(true)
    } catch (err) {
      if (!(err instanceof Error)) return
      if (err.message === GITHUB_SIGN_IN_REQUIRED) {
        discardPrimedGithubTab()
        setPendingGithubImport()
        navigate(`/auth/signin?next=${encodeURIComponent('/')}`)
        return
      }
      if (err.message === GITHUB_OAUTH_NOT_CONFIGURED) {
        alert(t('ed.importGithub.oauthNotConfigured'))
        return
      }
      if (err.message.includes('cerrada antes')) return
      alert(err.message || t('ed.importGithub.error'))
    } finally {
      setSubmitting(false)
    }
  }, [navigate, t, user, profile])

  const handleGithubImport = useCallback(() => {
    if (!canUseGithubImport(user, profile)) return
    primeGithubOAuthTab()
    void runGithubImport()
  }, [runGithubImport, user, profile])

  useEffect(() => {
    if (userLoading) return
    if (!hasPendingGithubImport()) return
    if (!hasRealAccount(user, profile)) return
    consumePendingGithubImport()
    void runGithubImport()
  }, [userLoading, user, profile, runGithubImport])

  return (
    <section className="landing-section landing-section--hero">
      {/* Background flourishes */}
      <div
        className="bg-grid"
        style={{
          position: "absolute",
          inset: 0,
          maskImage: "radial-gradient(ellipse at 50% 0%, black 25%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 25%, transparent 70%)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />
      <div className="container" style={{ position: "relative" }}>
        {/* Eyebrow pill */}
        <a
          href="/marketplace"
          onClick={(e) => {
            e.preventDefault();
            navigate("/marketplace");
          }}
          className="pill"
          style={{
            display: "inline-flex",
            background: "var(--surface)",
            fontSize: 12,
            padding: "5px 12px 5px 5px",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              background: "var(--accent-grad)",
              color: "white",
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 999,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            NEW
          </span>
          <span style={{ color: "var(--text-mid)" }}>{t("hero.pill")}</span>
          <Icon.Arrow />
        </a>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(44px, 6.4vw, 84px)",
            lineHeight: 1.0,
            letterSpacing: "-0.04em",
            fontWeight: 600,
            margin: "0 auto",
            maxWidth: 980,
            textWrap: "balance",
          }}
        >
          {t("hero.title.1")}
          <br />
          <span className="grad-text">{t("hero.title.2")}</span>
        </h1>

        {/* Subhead */}
        <p
          style={{
            margin: "26px auto 0",
            fontSize: 18,
            lineHeight: 1.5,
            color: "var(--text-mid)",
            maxWidth: 640,
            textWrap: "pretty",
          }}
        >
          {t("hero.subtitle")}
        </p>

        <div className="hero-prompt-wrap">
          <WebStudioPromptBar
            ref={promptBarRef}
            variant="hero"
            disabled={submitting}
            generating={submitting}
            modelChoice={modelChoice}
            modelOptions={modelOptions}
            onModelChoiceChange={setModelChoice}
            categoryChoices={categoryChoices}
            categoryModels={categoryModels}
            selectionMode={selectionMode}
            onCategoryModelChange={setCategoryModelChoice}
            onGithubImport={handleGithubImport}
            githubImportEnabled={canGithubImport}
            figmaImportEnabled={false}
            onSubmit={(prompt, opts) => void submitPrompt(prompt, opts)}
          />
        </div>

        {githubProjectId && (
          <GithubImportModal
            projectId={githubProjectId}
            open={githubImportOpen}
            onClose={() => {
              setGithubImportOpen(false)
              setGithubProjectId(null)
            }}
            onImported={() => {
              setGithubImportOpen(false)
              const id = githubProjectId
              setGithubProjectId(null)
              navigate(`/studio?project=${encodeURIComponent(id)}`)
            }}
          />
        )}

        {/* Suggestion chips */}
        <div className="hero-prompt-suggestions">
          <span
            style={{
              color: "var(--text-faint)",
              fontSize: 12.5,
              alignSelf: "center",
              marginRight: 4,
            }}
          >
            Try:
          </span>
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => promptBarRef.current?.setValue((v) => (v ? v : c))}
              className="pill"
              style={{
                cursor: "pointer",
                fontSize: 12.5,
                background: "var(--surface)",
                color: "var(--text-mid)",
                padding: "5px 12px",
                transition: "all 160ms var(--ease)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-mid)";
              }}
            >
              {c}
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Canvas & creative section
------------------------------------------------------------------ */

function CanvasCreativeSection() {
  const { t } = useApp();
  const items = [
    { id: "canvas-app", glyph: "✎", color: "var(--fw-canvas-app)" },
    { id: "canvas-game", glyph: "◈", color: "var(--fw-canvas-game)" },
    { id: "p5", glyph: "◎", color: "var(--fw-p5)" },
    { id: "phaser", glyph: "▣", color: "var(--fw-phaser)" },
    { id: "three", glyph: "◐", color: "var(--fw-three)" },
  ];
  return (
    <section className="landing-section landing-canvas-section">
      <div className="container">
        <header className="landing-section__head">
          <div className="eyebrow">{t("canvas.eyebrow")}</div>
          <h2 className="landing-section__title">{t("canvas.title")}</h2>
          <p className="landing-section__intro">{t("canvas.subtitle")}</p>
        </header>
        <div className="landing-canvas-grid">
          {items.map((it) => {
            const fw = FRAMEWORKS.find((f) => f.id === it.id);
            return (
              <article key={it.id} className="landing-canvas-card" style={{ "--card-accent": it.color }}>
                <span className="landing-canvas-card__glyph" aria-hidden>{it.glyph}</span>
                <h3>{fw?.name ?? it.id}</h3>
                <p>{t(`canvas.fw.${it.id}`)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Workflow section
------------------------------------------------------------------ */

function Workflow() {
  const { t } = useApp();
  const steps = [
    { kw: t("how.s1.k"), title: t("how.s1.t"), body: t("how.s1.d"), num: "01" },
    { kw: t("how.s2.k"), title: t("how.s2.t"), body: t("how.s2.d"), num: "02" },
    { kw: t("how.s3.k"), title: t("how.s3.t"), body: t("how.s3.d"), num: "03" },
    { kw: t("how.s4.k"), title: t("how.s4.t"), body: t("how.s4.d"), num: "04" },
  ];
  return (
    <section className="workflow-section">
      <div className="container">
        <header className="workflow-section__head">
          <div className="eyebrow">{t("how.eyebrow")}</div>
          <h2 className="workflow-section__title">{t("how.title")}</h2>
          <p className="workflow-section__subtitle">{t("how.subtitle")}</p>
        </header>

        <div className="workflow-steps">
          {steps.map((s, i) => (
            <article key={s.num} className="workflow-step">
              <span className="workflow-step__num">{s.num}</span>
              <span className="workflow-step__badge">{s.kw}</span>
              <h3 className="workflow-step__title">{s.title}</h3>
              <p className="workflow-step__body">{s.body}</p>
              {i < steps.length - 1 && (
                <span className="workflow-step__connector" aria-hidden>
                  <Icon.Arrow />
                </span>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Marketplace preview
------------------------------------------------------------------ */

const MARKETPLACE_ITEMS = [
  { name: "Stripe Checkout Pro", author: "@vercel", price: 24, stars: 1.2, framework: "next", desc: "Production-ready checkout with subs, invoices, customer portal." },
  { name: "Auth Starter Kit", author: "@oxidesh", price: 0, stars: 3.8, framework: "react", desc: "Email + OAuth + 2FA. JWT in HTTP-only cookies." },
  { name: "Analytics Dashboard", author: "@delphine", price: 49, stars: 0.9, framework: "vue", desc: "20+ chart components, dark mode, CSV export." },
  { name: "Realtime Chat", author: "@hugoam", price: 0, stars: 5.2, framework: "svelte", desc: "WebSocket chat with rooms, typing, presence." },
];

function MarketplacePreview() {
  const { t, navigate } = useApp();
  return (
    <section className="landing-section landing-section--marketplace">
      <div className="container">
        <header className="landing-section__intro">
          <div className="eyebrow">{t("mkt.eyebrow")}</div>
          <h2>{t("mkt.title")}</h2>
          <p>{t("mkt.subtitle")}</p>
        </header>

        <div className="landing-marketplace-grid">
          {MARKETPLACE_ITEMS.map((it) => {
            if (!it) return null
            const fw = FRAMEWORKS.find((f) => f.id === it.framework) ?? FRAMEWORKS[0];
            return (
              <div
                key={it.name}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  transition: "transform 200ms var(--ease), border-color 200ms var(--ease)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                onClick={() => navigate("/marketplace")}
              >
                <div
                  style={{
                    aspectRatio: "16/10",
                    background: `linear-gradient(135deg, color-mix(in srgb, ${fw.color} 25%, var(--surface)) 0%, var(--surface-2) 100%)`,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 56,
                      fontWeight: 700,
                      color: fw.color,
                      opacity: 0.6,
                    }}
                  >
                    {fw.glyph}
                  </span>
                  <span
                    className="badge"
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "var(--bg)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <span style={{ color: fw.color }}>●</span> {fw.name}
                  </span>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                    {it.author}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-mid)", lineHeight: 1.45, margin: 0, minHeight: 56 }}>
                    {it.desc}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                      {it.price === 0 ? t("mp.free") : "$" + it.price}
                    </span>
                    <span className="spacer" />
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 12 }}>
                      <Icon.Star /> {it.stars}k
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="landing-section__cta-row">
          <button type="button" onClick={() => navigate("/marketplace")} className="btn btn-ghost">
            {t("mkt.browse")} <Icon.Arrow />
          </button>
        </div>
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------
   FAQ
------------------------------------------------------------------ */

function FAQ() {
  const { t } = useApp();
  const items = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="landing-section landing-section--faq">
      <div className="container landing-faq-inner">
        <header className="landing-section__intro">
          <div className="eyebrow">{t("faq.eyebrow")}</div>
          <h2>{t("faq.title")}</h2>
        </header>
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {items.map((it, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                style={{
                  width: "100%",
                  padding: "22px 4px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  textAlign: "left",
                  color: "var(--text)",
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                <span style={{ flex: 1 }}>{it.q}</span>
                <span
                  style={{
                    transition: "transform 200ms var(--ease)",
                    transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                    color: "var(--text-muted)",
                  }}
                >
                  <Icon.Plus />
                </span>
              </button>
              <div
                style={{
                  maxHeight: open === i ? 200 : 0,
                  overflow: "hidden",
                  transition: "max-height 280ms var(--ease)",
                }}
              >
                <div style={{ padding: "0 4px 22px", color: "var(--text-mid)", fontSize: 15, lineHeight: 1.6 }}>
                  {it.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   CTA section
------------------------------------------------------------------ */

function FinalCTA() {
  const { t, navigate, lang } = useApp();
  const { isAuthenticated } = useUser();
  const onCtaClick = () => {
    if (isAuthenticated) {
      openStudio(navigate, lang === 'en' ? 'en' : 'es');
      return;
    }
    navigate('/auth/signin');
  };
  return (
    <section className="landing-section landing-section--cta">
      <div className="container">
        <div className="landing-cta-card">
          <div className="bg-grid landing-cta-card__grid" aria-hidden />
          <div className="landing-cta-card__body">
            <h2>{t("cta.title")}</h2>
            <p>{t("cta.subtitle")}</p>
            <div className="landing-cta-card__actions">
              <button type="button" onClick={onCtaClick} className="btn btn-primary btn-lg">
                {t('cta.auth')} <Icon.Arrow />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <CanvasCreativeSection />
      <Workflow />
      <MarketplacePreview />
      <FAQ />
      <FinalCTA />
    </MarketingShell>
  );
}

export { LandingPage, MARKETPLACE_ITEMS }
