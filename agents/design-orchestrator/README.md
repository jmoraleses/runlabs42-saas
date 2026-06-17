# Design Orchestrator — Agent Studio

Agente desplegable en **Vertex AI Agent Engine** (Agent Studio) que ejecuta las fases de texto del pipeline de diseño (tokens, layout, plan de assets).

La app web (`src/lib/design/orchestration.ts`) delega en este agente cuando está configurado:

```bash
DESIGN_AGENT_STUDIO_ENGINE=projects/MI_PROYECTO/locations/us-central1/reasoningEngines/MI_ENGINE_ID
# alias:
VERTEX_DESIGN_REASONING_ENGINE=MI_ENGINE_ID
```

Si la variable no está definida, la orquestación sigue usando Gemini directamente vía Vertex Agent Platform (comportamiento actual).

**Importante:** el deploy genera `deploy_staging/` con `orchestrator_agent.py` en la raíz del tarball y un script `installation_scripts/install_orchestrator.sh` que instala el wheel antes de arrancar el motor. Si ves `No module named 'orchestrator_agent'`, ejecuta `npm run deploy:design-agent` con la versión actual de `deploy.py`.

## Orquestación inteligente (`run_orchestration`)

El agente coordina **tokens → layout (con reintento anti-plantilla) → plan de assets** usando Vertex con el `model_id` que elige el usuario en Studio.

La app invoca:

```json
{
  "class_method": "run_orchestration",
  "input": {
    "brief": { "prompt": "...", "siteType": "ecommerce", "brandTone": "..." },
    "model_id": "gemini-2.5-flash",
    "device": "desktop"
  }
}
```

Respuesta: `{ "events", "tokens_json", "layout_json", "asset_plan_json", "model_id" }`.

La fase **HTML** (streaming al lienzo) la ejecuta la app con los artefactos del agente.

## Despliegue

Cada `npm run deploy:design-agent`:

- **Primera vez** (sin `DESIGN_AGENT_STUDIO_ENGINE`): crea un reasoning engine nuevo.
- **Siguientes veces**: actualiza el mismo recurso con `agent_engines.update()` — no duplica orquestadores en GCP.

El resource name en `.env.local` se mantiene estable salvo que borres el motor a mano en consola.

```bash
npm run deploy:design-agent
```

Con `--write-env` (por defecto en el script npm) actualiza `.env.local` solo si el resource name cambia (p. ej. primer deploy).

## Contrato `query`

La app invoca `:query` con:

```json
{
  "class_method": "query",
  "input": {
    "phase": "visual-identity",
    "prompt": "...",
    "system_instruction": "...",
    "response_mime_type": "application/json",
    "model_id": "gemini-2.5-flash"
  }
}
```

Respuesta esperada: `{ "text": "..." }` (JSON del modelo).

La fase HTML (`content-generation`) sigue usando streaming directo a Vertex desde la app para el efecto progresivo en el lienzo.
