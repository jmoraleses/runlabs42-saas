# Pautas del orquestador (referencia Google Stitch)

Documento de diseño del pipeline Runlabs para acercar la salida a **proyectos generados en Stitch**, usando `gemini-2.5-flash-lite` y sin depender de Imagen API.

Basado en: export HTML/PNG de Stitch (*Pollitos Amarillos*), benchmark `uploads/stitch-benchmark-2026-05-25T15-13-02/`, y contraste con el orquestador actual.

---

## 1. Objetivo del orquestador

El orquestador no debe “inventar un diseño genérico Material”. Debe:

1. Leer un **brief único** (el mismo texto que usarías en Stitch).
2. Materializar **`spec/design.md`** como fuente de verdad (YAML M3 + secciones editoriales).
3. Producir **una pantalla HTML completa por llamada**, visualmente coherente con ese sistema.
4. **Revisar con captura** (screenshot + design.md), no solo lint de código.

La métrica de éxito es **equivalencia visual** (paleta, tipo, ritmo, jerarquía, densidad), no “HTML válido”.

---

## 2. Qué hace Stitch distinto (patrones observados)

| Aspecto | Stitch (gold) | Runlabs actual (desvío) |
|--------|---------------|-------------------------|
| CSS | Tailwind CDN + `tailwind.config` con **hex literales** del tema | `:root` + CSS vanilla largo |
| Tokens en HTML | `bg-primary`, `text-on-surface`, `font-headline-xl` | `--color-primary`, clases custom |
| Tipografía | **Una familia** (Quicksand) en toda la escala | Mezcla display + body (Playfair + Lato) sin brief |
| design.md | YAML M3 completo + roles surface/primary-container | YAML correcto pero HTML no lo aplica igual |
| Generación HTML | **Una pasada** integrada | shell → 5 secciones → footer (pierde cohesión en flash-lite) |
| Imágenes | Fotos reales integradas | Gradientes / placeholders |
| Espaciado | `margin-desktop`, `gutter-desktop`, secciones muy aireadas | `--spacing-section-gap-*` en CSS pero layout distinto |
| Detalle UI | `.bouncy-hover`, `.soft-shadow` con tinte de marca | Poco micro-interacción |

Conclusión: el gap principal no es el modelo, es **stack CSS + granularidad del pipeline**.

---

## 3. Pautas por fase

### 3.1 Brief (entrada)

- Un solo `prompt` es la semilla; no contradecir con plantillas (ej. brief café vs referencia pollitos).
- **Idioma:** el export Stitch de referencia suele estar en **inglés** (`lang="en"`). Runlabs infiere **español** del brief (`resolveOrchestrationLocale`); la referencia HTML solo guía layout/clases — el copy se traduce. Forzar inglés: `brief.locale: "en"` o `DESIGN_ORCHESTRATION_LOCALE=en`.
- Inferir `siteType`, secciones y tono, pero **no sustituir** el producto del usuario.
- Si existe referencia Stitch (`stitchProjectId` + `prompt.txt`): el prompt de referencia va **antes** del prompt del usuario en la composición.

### 3.2 `spec/design.md`

**Debe incluir siempre:**

- Frontmatter YAML con **todos** los roles M3 (`surface-container-*`, `on-*`, `primary-container`, fixed, etc.) en **hex**, no `var(--md-sys-*)`.
- Bloque `typography` con escalas nombradas: `headline-xl`, `headline-lg`, `body-md`, `label-md` (como Stitch, no solo “heading/body” genéricos).
- `rounded` + `spacing` (`unit`, `container-margin`, `gutter`, `margin-mobile`, `margin-desktop`).
- Secciones markdown: **Brand & Style**, **Layout & Spacing**, **Components**, **Elevation & Depth**, **Photography & Imagery**.

**Pautas de generación:**

- Preferir **menos pasos secuenciales** en flash-lite; muchos pasos diluyen el concepto (Stitch genera el sistema de una pieza).
- Si hay `designTheme` importado de Stitch, **usar ese markdown** y no regenerar paleta desde cero.
- El design.md debe poder mapearse 1:1 a `tailwind.config.theme.extend` (colores, fontFamily, fontSize, spacing).

### 3.3 Layout (`spec/design-layout.json`)

- Páginas y secciones **específicas del brief**, no plantilla nav→hero→features genérica.
- `layoutStrategy` alineado con el HTML que Stitch produciría (marketing denso vs editorial aireado).
- Una pantalla nueva = un id claro; no mezclar regeneración total con páginas existentes sin `rebuildPageIds`.

### 3.4 HTML (fase crítica)

**Pauta A — Monolito por pantalla (obligatorio en flash-lite)**

- Una llamada LLM → un `<!DOCTYPE html>…</html>` completo.
- No usar shell + N secciones + footer en modelos lite salvo fallback explícito.

**Pauta B — Stack Stitch (paridad)**

Por defecto (salvo `DESIGN_STITCH_PARITY=0`):

1. `<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries">`
2. Google Fonts de las familias del YAML.
3. Material Symbols si hay iconografía.
4. `<script id="tailwind-config">` con `theme.extend.colors` = claves del YAML (kebab-case, hex literal).
5. Markup con **clases Tailwind** (`bg-surface-container`, `text-headline-xl`, etc.).
6. `<style>` mínimo solo para utilidades (`.bouncy-hover`, `.soft-shadow`, icon font).
7. `data-sk-id` en nodos editables.

**Pauta C — Sin frameworks pesados**

- No React/Vue en esta fase; HTML estático como Stitch.

**Pauta D — Placeholders de imagen**

- Sin Imagen API: `div` con gradiente en paleta + `aspect-ratio` + tamaño fijo, o `picsum` solo si el brief lo permite.
- Reservar altura para no colapsar el layout.

**Pauta E — Referencia HTML (opcional)**

- Si hay HTML Stitch de referencia en el prompt: replicar **composición y densidad**, no copiar texto literal ni URLs externas.

### 3.5 Revisión HTML (`html-review`)

- Entrada: HTML **completo** + `design.md` **completo** + **screenshot PNG** del render.
- Criterio: equivalencia **visual** con design.md y con referencia Stitch si existe.
- Salida: HTML **completo** refinado (mismo stack Tailwind si se usó en generación).
- No “arreglar” cambiando el producto (café ↔ pollitos).

### 3.6 Imágenes (Imagen API)

- Opcional y **al final**; no bloquear HTML.
- Si está desactivado, los prompts no deben exigir `[IMAGE:]` ni romper el layout por fotos faltantes.

---

## 4. Orden del pipeline recomendado

```text
brief (+ referencia Stitch opcional)
  → design.md (importado o 1–2 llamadas máx. en lite)
  → tokens JSON (derivado del YAML, sin contradecir design.md)
  → layout JSON (específico del brief)
  → HTML monolítico por pantalla (Tailwind + design.md)
  → html-review (screenshot + design.md [+ ref. HTML])
  → (opcional) assets Imagen
```

Evitar en flash-lite:

- design.md en 12+ micro-pasos antes del HTML.
- HTML en 6+ partes con SSE si el modelo pierde el hilo visual.

---

## 5. Reglas de prompts (resumen para system instructions)

1. **design.md gana** sobre tokens JSON si hay conflicto.
2. **Hex del YAML** son los colores en pantalla; no sustituir por paleta corporativa genérica.
3. **Tipografía del YAML** en toda la página; no mezclar familias no pedidas.
4. **Jerarquía**: `headline-xl` en hero, `body-md` en párrafos, `label-md` en metadatos.
5. **CTAs**: `primary-container` / `on-primary-container`, fondos `surface-container-*`.
6. **Densidad**: landings con secciones claras; catálogos 6–12 ítems, no grids infinitos repetidos.
7. **Copia**: específica del producto del brief; prohibido Lorem y cards clonadas.
8. **data-sk-id**: conservar en revisión.

---

## 6. Modelos

| Tarea | flash-lite | flash / pro |
|-------|------------|-------------|
| design.md (rico) | Solo si importado de Stitch o brief simple | Preferible |
| layout JSON | Sí | Sí |
| HTML monolito + Tailwind | Sí (con pautas Stitch) | Sí |
| html-review con imagen | Sí (screenshot obligatorio) | Sí |

Si la calidad de design.md es pobre en lite, **importar** desde Stitch (`designTheme` / `design.md` exportado) antes de generar HTML.

---

## 7. Criterios de aceptación (checklist QA)

Antes de dar una pantalla por buena:

- [ ] Los hex visibles coinciden con el frontmatter de `design.md` (muestreo primary, surface, on-surface).
- [ ] La tipografía es la del YAML (no una fuente por defecto del modelo).
- [ ] El stack es Tailwind + config (en modo paridad), no solo variables CSS sueltas.
- [ ] Hero + al menos 2 secciones del layout están presentes y alineadas al brief.
- [ ] Screenshot de revisión sin placeholders rotos ni scroll vacío kilométrico.
- [ ] Comparación lado a lado con referencia Stitch (si el objetivo es paridad).

---

## 8. Implementación en código (mapa)

| Pauta | Archivo / flag |
|------|----------------|
| Paridad Tailwind + monolito | `stitchParity.ts`, `orchestrationPrompts.ts`, `DESIGN_STITCH_PARITY` |
| Sin HTML incremental en lite | `orchestrationIncrementalHtml.ts` → `preferMonolithicOrchestrationHtml` |
| Referencia Stitch en prompts | `stitchReference.ts`, `brief.stitchProjectId` |
| Revisión con screenshot | `orchestrationHtmlReview.ts`, Playwright |
| design.md desde tema Stitch | `designMdFromStitchTheme()` |

---

## 9. Lo que la API de Stitch no resuelve

- **No expone** el historial de prompts de la UI: hay que guardar el prompt manualmente para A/B.
- **Paridad pixel-perfect** sin referencia HTML/PNG del mismo brief es irreal en lite.
- **Fotos reales** como Stitch requieren Imagen API o assets externos; las pautas asumen placeholders conscientes.

---

## 10. Próximo paso de producto

Validar estas pautas con **el mismo brief** en Stitch y en Runlabs, medir gap en screenshot, y ajustar solo prompts (no añadir fases) hasta que el checklist §7 pase en 2–3 proyectos reales.

Referencias locales: `uploads/stitch-reference/2510768920948183313/`, `uploads/stitch-benchmark-2026-05-25T15-13-02/`.
