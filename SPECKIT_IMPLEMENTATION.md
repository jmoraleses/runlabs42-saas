# Spec-Kit Implementation - Detalle Técnico

## Descripción General

Runlabs42 implementa Spec-Driven Development siguiendo el estándar de [github/spec-kit](https://github.com/github/spec-kit). Este documento detalla cómo funciona el proceso completo desde la interfaz de usuario hasta la generación de código.

---

## Arquitectura del Sistema

### 1. **Frontend: Activar Planificar**

```
Usuario en Studio / Landing Page
    ↓
Busca toggle "Planificar" (SpecKitToggle)
    ↓
Activa/desactiva con localStorage (useSpecKitPreference hook)
    ↓
Envía prompt con { text, images, useSpecKit: true }
```

**Componentes Involucrados:**
- `ChatComposerBar` - Muestra SpecKitToggle
- `SpecKitToggle` - Toggle en/off de plan mode
- `useSpecKitPreference` - Persiste preferencia en localStorage

### 2. **API: Stream Route**

**Ruta:** `POST /api/stream`

```
{
  prompt: string
  useSpecKit: boolean
  projectId?: string
  projectName?: string
  framework?: string
  files?: { path: string; content: string }[]
  images?: ...
}
```

**Lógica en stream/route.ts:**

```typescript
const useSpecKit = body.useSpecKit === true

if (useGemini) {
  if (useSpecKit && (parsed.command === '/build' || '/mobile-fix')) {
    // Ejecutar pipeline spec-kit completo
    const result = await runSpecKitPipeline({
      userPrompt: parsed.prompt || prompt,
      projectName: streamContext.projectName,
      framework: streamContext.framework,
      files: streamContext.files,
      images: resolvedImages,
      send, // SSE callback
      modelId,
      initialArtifacts,
    })
    
    // Retornar archivos generados
    if (result.fileUpdates.length) {
      send('files', JSON.stringify(result.fileUpdates))
    }
  } else {
    // Generación normal sin spec-kit
    await streamGeminiAgent(parsed, streamContext, send, modelId)
  }
}
```

### 3. **Pipeline: 5 Fases**

**Archivo:** `lib/ai/spec-kit/pipeline.ts`

```
runSpecKitPipeline()
    ├─ Phase 1: Constitution
    │   ├─ Prompt: buildSpecKitPhasePrompt('constitution', ...)
    │   ├─ AI Response: Principios del proyecto
    │   └─ Save: specs/constitution.md
    │
    ├─ Phase 2: Specify
    │   ├─ Prompt: buildSpecKitPhasePrompt('specify', ...)
    │   ├─ AI Response: Especificaciones funcionales
    │   └─ Save: specs/spec.md
    │
    ├─ Phase 3: Plan
    │   ├─ Prompt: buildSpecKitPhasePrompt('plan', ...)
    │   ├─ AI Response: Plan técnico
    │   └─ Save: specs/plan.md
    │
    ├─ Phase 4: Tasks
    │   ├─ Prompt: buildSpecKitPhasePrompt('tasks', ...)
    │   ├─ AI Response: Lista de tareas
    │   └─ Save: specs/tasks.md
    │
    └─ Phase 5: Implement
        ├─ Prompt: buildSpecKitPhasePrompt('implement', ...)
        ├─ AI Response: Código completo
        └─ Retornar fileUpdates para aplicar
```

### 4. **Prompts: Instrucciones de Cada Fase**

**Archivo:** `lib/ai/spec-kit/prompts.ts`

#### Constitution
```markdown
Create or update the project constitution with:
- Core principles (quality, UX, performance, security)
- Technical standards and patterns
- Testing strategy and coverage goals
- Accessibility and performance targets
- Code organization rules
```

#### Specify
```markdown
Define WHAT to build and WHY:
- User personas and journey mapping
- Functional requirements by feature
- User stories in Gherkin format
- Acceptance criteria for each feature
- Out-of-scope items explicitly listed
```

#### Plan
```markdown
Create detailed technical plan:
- Technology stack: {framework}
- System architecture
- Database schema
- API endpoints
- Frontend structure
- Authentication strategy
```

#### Tasks
```markdown
Generate implementation checklist:
- Numbered tasks in execution order
- Clear descriptions
- Dependencies between tasks
- Estimated complexity
- Related files
```

#### Implement
```markdown
Generate complete, production-ready code:
- All necessary files for {framework}
- Components: functional, with hooks
- Styling: Tailwind CSS or inline
- Routing: clear structure
- Mobile-first responsive design
```

### 5. **Artefactos y Rutas**

**Archivo:** `lib/ai/spec-kit/artifacts.ts`

```typescript
SPEC_KIT_PATHS = {
  constitution: 'specs/constitution.md',
  spec: 'specs/spec.md',
  plan: 'specs/plan.md',
  tasks: 'specs/tasks.md',
}
```

Cada fase actualiza su archivo correspondiente:
```
project/
├── specs/
│   ├── constitution.md     ← Phase 1
│   ├── spec.md            ← Phase 2
│   ├── plan.md            ← Phase 3
│   └── tasks.md           ← Phase 4
└── src/
    └── ... (Phase 5 output)
```

---

## Flujo Completo - Paso a Paso

### 1. Usuario Activa Planificar

```
Landing Page / Studio
├─ ChatComposerBar
│  └─ SpecKitToggle
│     └─ localStorage: 'runlabs_use_spec_kit' = '1'
└─ Chat input ready
```

### 2. Usuario Envía Prompt

```
Input: "Crear dashboard de ventas con gráficos"
Submit: { text, images, useSpecKit: true }
```

### 3. Frontend Envía a API

```
POST /api/stream {
  prompt: "Crear dashboard de ventas con gráficos",
  useSpecKit: true,
  projectId: "proj_123",
  projectName: "Sales Dashboard",
  framework: "next",
  files: [...existing files],
}
```

### 4. Backend - Phase 1: Constitution

```
Prompt:
  "Crear dashboard de ventas con gráficos
   
   Create or update the project constitution with:
   - Core principles (quality, UX, performance, security)
   - Testing strategy..."

AI Response:
  "## Project Constitution
   
   ### Quality Principles
   - Performance: < 1s first contentful paint
   - Code quality: 100% typed, max 10 functions per file
   
   ### UX Standards
   - Dark/light mode support..."

Save → specs/constitution.md
```

### 5. Backend - Phase 2: Specify

```
Prompt:
  "Crear dashboard de ventas con gráficos
   
   ## Constitution (context from phase 1)
   [Previous constitution]
   
   Define WHAT to build and WHY:
   - User personas
   - Functional requirements
   - User stories in Gherkin format
   - Acceptance criteria..."

AI Response:
  "## Sales Dashboard Specification
   
   ### User Personas
   - Sales Manager: monitor team performance
   - Executive: view company metrics
   
   ### Features
   1. Revenue Dashboard
      Given: User is authenticated
      When: Opens dashboard
      Then: Shows YTD revenue"

Save → specs/spec.md
```

### 6. Backend - Phase 3: Plan

```
Prompt:
  "Crear dashboard de ventas con gráficos
   
   ## Constitution & Specification (context)
   [Previous artifacts]
   
   Create detailed technical plan:
   - Technology stack: next
   - System architecture
   - Database schema
   - API endpoints..."

AI Response:
  "## Technical Plan
   
   ### Stack
   - Frontend: Next.js 14 + React 18
   - Styling: Tailwind CSS
   - Charts: Recharts library
   - State: React Context API
   
   ### Architecture
   - pages/dashboard/ - Dashboard pages
   - components/charts/ - Chart components
   - hooks/useSalesData.ts - Data fetching"

Save → specs/plan.md
```

### 7. Backend - Phase 4: Tasks

```
Prompt:
  "Crear dashboard de ventas con gráficos
   
   [All previous artifacts as context]
   
   Generate implementation checklist:
   - Numbered tasks in order
   - Dependencies
   - Complexity estimates..."

AI Response:
  "## Implementation Tasks
   
   1. Set up project structure [small]
   2. Create dashboard layout component [medium]
   3. Build chart components [large]
      - Depends on: #2
   4. Fetch sales data [medium]
   5. Connect data to charts [small]
      - Depends on: #3, #4"

Save → specs/tasks.md
```

### 8. Backend - Phase 5: Implement

```
Prompt:
  "Crear dashboard de ventas con gráficos
   
   [All previous artifacts as context]
   
   Generate complete, production-ready code:
   - All necessary files for next
   - Components: functional, typed
   - Styling: Tailwind CSS
   - Mobile-first responsive..."

AI Response:
  "```tsx src/app/dashboard/page.tsx
   'use client'
   
   import { DashboardLayout } from '@/components/dashboard/layout'
   import { RevenueChart } from '@/components/charts/revenue'
   
   export default function DashboardPage() {
     return (
       <DashboardLayout>
         <RevenueChart />
       </DashboardLayout>
     )
   }
   ```
   
   ```tsx src/components/dashboard/layout.tsx
   export function DashboardLayout({ children }) {
     return (...)
   }
   ```"

Parse & Extract Files:
  ├─ src/app/dashboard/page.tsx
  ├─ src/components/dashboard/layout.tsx
  └─ ...more files...

Return: fileUpdates = [{ path, content }, ...]
```

### 9. Frontend Recibe Archivos

```
SSE Response:
  data: { type: 'files', data: JSON.stringify(fileUpdates) }

Editor:
  ├─ Aplica los archivos al proyecto
  ├─ Muestra specs/ folder
  └─ Permite editar cualquier archivo .md
```

### 10. Usuario Ve Resultado

```
Project Structure:
  ├── specs/
  │   ├── constitution.md
  │   ├── spec.md
  │   ├── plan.md
  │   └── tasks.md
  └── src/
      ├── app/dashboard/page.tsx
      ├── components/dashboard/layout.tsx
      └── ...más archivos generados...
```

---

## Archivos Clave del Sistema

### Frontend
- `components/chat/SpecKitToggle.tsx` - Toggle UI
- `components/chat/ChatComposerBar.tsx` - Integración en composer
- `lib/chat/useSpecKitPreference.ts` - Estado persistente
- `components/editor/AIChatPanel.tsx` - Chat en editor

### Backend API
- `app/api/stream/route.ts` - Endpoint principal
  - Detecta `useSpecKit: true`
  - Ejecuta pipeline si es /build
  - Retorna archivos generados

### Spec-Kit Core
- `lib/ai/spec-kit/pipeline.ts` - 5 phases
- `lib/ai/spec-kit/prompts.ts` - Instrucciones detalladas
- `lib/ai/spec-kit/artifacts.ts` - Rutas y tipos
- `lib/ai/spec-kit/commands.ts` - Mapeo de comandos

---

## Condiciones para Ejecutar Spec-Kit

✅ Se ejecuta cuando:
- `useSpecKit === true` en request
- `parsed.command === '/build'` o `'/mobile-fix'`
- `useGemini === true` (modelo Gemini disponible)

❌ NO se ejecuta cuando:
- `useSpecKit === false` → Generación normal
- Mock model activo → No usa pipeline
- Comando diferente de /build

---

## Mejoras en Esta Versión

1. **Prompts Mejorados**
   - Más específicos y detallados
   - Siguiendo spec-kit standard
   - Mejor contexto entre fases

2. **Rutas en specs/**
   - Archivos accesibles en editor
   - Usuario puede editarlos
   - Regenerar código con specs modificadas

3. **Integración Completa**
   - Studio ✓
   - Landing Page ✓
   - Persistencia de preferencia ✓
   - Streaming de respuestas ✓

---

## Validación del Sistema

### Test Manual

1. **Activar Planificar**
   ```
   Landing Page → Buscar toggle "Planificar" → Activar
   ```

2. **Enviar Prompt**
   ```
   Input: "Crear una app de notas con búsqueda"
   Submit
   ```

3. **Verificar Fases**
   - Ver cómo el AI responde 5 veces (constitution → specify → plan → tasks → implement)
   - Cada respuesta se debe ver en el chat progresivamente

4. **Verificar Archivos**
   ```
   Editor Files:
   ✓ specs/constitution.md
   ✓ specs/spec.md
   ✓ specs/plan.md
   ✓ specs/tasks.md
   ✓ src/App.tsx
   ✓ ...otros archivos...
   ```

5. **Editar Specs**
   ```
   Abre specs/spec.md
   Modifica requirements
   Cierra editor
   Vuelve a generar con nuevos specs
   ```

---

## Debugging

### Si no se ejecuta spec-kit:

1. **Verificar toggle activado:**
   ```javascript
   localStorage.getItem('runlabs_use_spec_kit') // Debe ser '1'
   ```

2. **Verificar modelo:**
   - Debe ser Gemini (no Mock)
   - Verificar env vars en .env.local

3. **Verificar comando:**
   - El prompt debe llegar como /build
   - No /spec o /plan solamente

4. **Revisar logs:**
   ```bash
   # En browser console
   Network tab → streaming responses
   # Ver si hay 5 eventos 'phase' seguidos
   ```

---

## Stack Tecnológico

- **AI Model:** Google Gemini API
- **Streaming:** Server-Sent Events (SSE)
- **State Management:** React Context + localStorage
- **File System:** En-memory (proyecto del usuario)
- **Markdown:** Plain text en archivos .md

---

Este documento refleja la implementación actual de Spec-Kit en Runlabs42. El sistema está completamente funcional y listo para usar.
