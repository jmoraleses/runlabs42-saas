export type DeployValidationIssue = {
  id: string
  message: string
  severity: 'error' | 'warning'
}

import type { CodeTemplate } from '@/lib/codeTemplates'
import { codeTemplateUsesNextBackend, normalizeCodeTemplate } from '@/lib/codeTemplates'
import type { SiteManifest } from '@/lib/design/siteManifest'

export type DeployValidationResult = {
  ok: boolean
  issues: DeployValidationIssue[]
}

export type ValidateDeployOptions = {
  codeTemplate?: CodeTemplate
  manifest?: SiteManifest | null
}

function validateStaticPreview(paths: Set<string>, issues: DeployValidationIssue[]) {
  const hasPreview =
    paths.has('preview/index.html') ||
    paths.has('index.html') ||
    [...paths].some((p) => p.startsWith('preview/') && p.endsWith('.html'))

  if (!hasPreview) {
    issues.push({
      id: 'missing-preview-html',
      message: 'Se necesita preview/index.html para el deploy estático',
      severity: 'error',
    })
  } else if (!paths.has('vercel.json')) {
    issues.push({
      id: 'missing-vercel-json',
      message: 'Falta vercel.json para enrutar el preview',
      severity: 'warning',
    })
  }
}

export function validateProjectForWebDeploy(
  files: { path: string; content: string }[],
  manifestOrOpts?: SiteManifest | null | ValidateDeployOptions,
): DeployValidationResult {
  const opts: ValidateDeployOptions =
    manifestOrOpts && 'codeTemplate' in (manifestOrOpts as ValidateDeployOptions)
      ? (manifestOrOpts as ValidateDeployOptions)
      : { manifest: manifestOrOpts as SiteManifest | null | undefined }

  const manifest = opts.manifest
  const codeTemplate = normalizeCodeTemplate(opts.codeTemplate)
  const issues: DeployValidationIssue[] = []
  const paths = new Set(files.map((f) => f.path))

  const hasNextApp =
    paths.has('app/page.tsx') ||
    paths.has('app/layout.tsx') ||
    [...paths].some((p) => p.startsWith('app/') && p.endsWith('/page.tsx'))

  const isStaticTemplate = codeTemplate !== 'html' || !hasNextApp

  if (isStaticTemplate && !codeTemplateUsesNextBackend(codeTemplate)) {
    validateStaticPreview(paths, issues)
    if (codeTemplate !== 'html') {
      const hasExport = [...paths].some((p) => p.startsWith('export/'))
      if (!hasExport) {
        issues.push({
          id: 'missing-cms-export',
          message: `Faltan artefactos en export/ para ${codeTemplate} (descarga del proyecto)`,
          severity: 'warning',
        })
      }
    }
    return {
      ok: !issues.some((i) => i.severity === 'error'),
      issues,
    }
  }

  let isNext = false

  if (!paths.has('package.json')) {
    issues.push({
      id: 'missing-package-json',
      message: 'Falta package.json',
      severity: 'error',
    })
  } else {
    try {
      const pkg = JSON.parse(files.find((f) => f.path === 'package.json')!.content) as {
        scripts?: Record<string, string>
        dependencies?: Record<string, string>
      }
      if (!pkg.scripts?.build) {
        issues.push({
          id: 'missing-build-script',
          message: 'package.json debe incluir script "build"',
          severity: 'warning',
        })
      }
      isNext = Boolean(pkg.dependencies?.next)
    } catch {
      issues.push({
        id: 'invalid-package-json',
        message: 'package.json no es JSON válido',
        severity: 'error',
      })
    }
  }

  const hasEntry =
    hasNextApp ||
    paths.has('index.html') ||
    paths.has('preview/index.html') ||
    paths.has('src/main.tsx') ||
    paths.has('src/main.jsx') ||
    paths.has('src/App.tsx')
  if (!hasEntry) {
    issues.push({
      id: 'missing-entry',
      message: 'Se necesita app/page.tsx (Next.js), preview/index.html o index.html',
      severity: 'error',
    })
  }

  if (isNext || hasNextApp) {
    if (!paths.has('app/layout.tsx')) {
      issues.push({
        id: 'missing-app-layout',
        message: 'Falta app/layout.tsx para Next.js App Router',
        severity: 'error',
      })
    }
    if (manifest?.forms.length && ![...paths].some((p) => p.startsWith('app/api/forms/'))) {
      issues.push({
        id: 'missing-form-api',
        message: 'Faltan rutas app/api/forms/ para los formularios del manifiesto',
        severity: 'error',
      })
    }
  } else if (!paths.has('index.html') && !paths.has('preview/index.html')) {
    issues.push({
      id: 'missing-index-html',
      message: 'index.html o preview/index.html recomendado para deploy estático',
      severity: 'warning',
    })
  }

  if (manifest?.requiresDatabase && !manifest.envRequired.includes('POSTGRES_URL')) {
    issues.push({
      id: 'manifest-db-env',
      message: 'El manifiesto requiere base de datos pero no declara POSTGRES_URL',
      severity: 'warning',
    })
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
  }
}
