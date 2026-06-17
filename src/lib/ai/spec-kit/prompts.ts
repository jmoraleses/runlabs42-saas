import type { SpecKitArtifacts, SpecKitPhase } from '@/lib/ai/spec-kit/artifacts'

/** Prompts alineados con Spec-Driven Development (github/spec-kit). */

export function buildSpecKitPhasePrompt(
  phase: SpecKitPhase | 'clarify',
  userPrompt: string,
  artifacts: SpecKitArtifacts,
  opts?: { framework?: string; projectName?: string },
): string {
  const framework = opts?.framework ?? 'Next.js'
  const projectName = opts?.projectName ?? 'Project'

  const ctx = [
    `Project: ${projectName}`,
    `Framework: ${framework}`,
    artifacts.constitution ? `## Constitution\n${artifacts.constitution}` : '',
    artifacts.spec ? `## Specification\n${artifacts.spec}` : '',
    artifacts.plan ? `## Technical Plan\n${artifacts.plan}` : '',
    artifacts.tasks ? `## Tasks\n${artifacts.tasks}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const base = userPrompt.trim() || `Continue developing according to project context for ${projectName}.`
  const prompt = ctx ? `${ctx}\n\n${base}` : base

  switch (phase) {
    case 'constitution':
      return `${prompt}

Create or update the project constitution with:
- Core principles (quality, UX, performance, security)
- Technical standards and patterns
- Testing strategy and coverage goals
- Accessibility and performance targets
- Code organization rules

Format as markdown with clear sections.
Keep it concise but comprehensive.`

    case 'specify':
      return `${prompt}

Define WHAT to build and WHY. Generate specification with:
- User personas and journey mapping
- Functional requirements by feature
- User stories in Gherkin format (Given/When/Then)
- Acceptance criteria for each feature
- Out-of-scope items explicitly listed
- Data model and key entities

Focus on requirements, NOT implementation.
Do NOT choose technical stack or architecture yet.
Format as markdown with user stories and acceptance criteria.`

    case 'plan':
      return `${prompt}

Create detailed technical plan including:
- Technology stack: ${framework}
- System architecture (components, layers, data flow)
- Database schema and data relationships
- API endpoints and data contracts
- Frontend structure (pages, components, routes)
- Authentication & authorization strategy
- File structure and organization
- Key libraries and their purpose
- Performance and scaling considerations

Include concrete examples of routes, components, and data models.
Each section should be actionable for implementation.
Format as markdown with code examples where relevant.`

    case 'tasks':
      return `${prompt}

Generate implementation checklist with:
- Numbered tasks in execution order
- Clear descriptions for each task
- Dependencies between tasks (if any)
- Estimated complexity (small/medium/large)
- Related file(s) that will be created/modified

Format as markdown checklist that developers can follow step-by-step.
Each task should be specific and actionable.
Group related tasks together.`

    case 'implement':
      return `${prompt}

Generate complete, production-ready code with:
- All necessary files for ${framework} project
- Components: functional, with hooks, typed props
- Styling: Tailwind CSS or inline styles (framework appropriate)
- Routing: clear structure matching the technical plan
- Mobile-first responsive design
- Error handling and loading states
- Data management (state, context, or API calls)

OUTPUT FORMAT FOR CODE: One markdown code fence per file
Each fence starts with: \`\`\`tsx src/path/to/file.tsx
Include imports, exports, and complete working code.
No placeholder code - everything should work.
No privacy/legal pages unless explicitly requested.

IMAGE GENERATION: When the UI needs images (hero banners, illustrations, icons, backgrounds, product images, avatars, etc.), declare them using this exact syntax BEFORE the code block that uses them:

[IMAGE: public/images/filename.jpg | Detailed visual description for AI image generation | aspect-ratio]

Rules for image declarations:
- Use descriptive filenames: hero-banner.jpg, dashboard-bg.png, user-avatar.png
- Write detailed prompts: style, colors, mood, content
- Aspect ratios: 16:9 (landscape), 1:1 (square), 9:16 (portrait), 4:3, 3:2
- Reference the same path in the code: <img src="/images/filename.jpg" />
- Generate images for: hero sections, backgrounds, product mockups, illustrations, empty states, onboarding screens
- Do NOT generate images for: icons (use SVG), logos (use text/SVG), UI components

Example:
[IMAGE: public/images/hero-dashboard.jpg | A modern SaaS dashboard hero image, dark blue gradient background, abstract data visualization, professional and clean, tech startup aesthetic | 16:9]
[IMAGE: public/images/empty-state.png | Friendly illustration of an empty inbox, minimal flat design, soft blue and white colors, cartoon style | 1:1]`

    case 'clarify':
      return `${prompt}

Ask clarifying questions to understand:
- Target users and their needs
- Success metrics for the project
- Constraints (timeline, performance, budget)
- Integration requirements
- Existing systems to connect with
- Data security or compliance needs

Ask specific, concrete questions. Avoid yes/no questions.
Help narrow down scope and requirements.`

    default:
      return base
  }
}

export function buildSpecKitFullContext(artifacts: SpecKitArtifacts, opts?: { framework?: string; projectName?: string }): string {
  return `# ${opts?.projectName ?? 'Project'} - Complete Specification Context

${artifacts.constitution ? `## Constitution\n${artifacts.constitution}\n` : ''}
${artifacts.spec ? `## Specification\n${artifacts.spec}\n` : ''}
${artifacts.plan ? `## Technical Plan\n${artifacts.plan}\n` : ''}
${artifacts.tasks ? `## Implementation Tasks\n${artifacts.tasks}\n` : ''}`
}

export function specKitSystemHint(phase: SpecKitPhase | 'clarify'): string {
  const hints: Record<SpecKitPhase | 'clarify', string> = {
    constitution: 'Genera principios de gobierno del proyecto en markdown.',
    specify: 'Especificación funcional: qué y por qué, sin código.',
    plan: 'Plan técnico detallado con entregables.',
    tasks: 'Checklist de tareas accionables en markdown.',
    implement:
      'Genera código en bloques ``` con ruta (ej. ```tsx src/App.tsx, ```tsx src/pages/About.tsx). Código completo por archivo; cada bloque sobrescribe el archivo existente. Varias páginas → src/pages/ + Routes en App (sobrescribe App.tsx si hace falta).',
    clarify: 'Preguntas concretas para desambiguar requisitos.',
  }
  return hints[phase]
}

export function buildSpecKitContextBlock(artifacts: SpecKitArtifacts): string {
  return [
    artifacts.constitution && `### Constitution\n${artifacts.constitution}`,
    artifacts.spec && `### Spec\n${artifacts.spec}`,
    artifacts.plan && `### Plan\n${artifacts.plan}`,
    artifacts.tasks && `### Tasks\n${artifacts.tasks}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
