# Crédito trial «GenAI App Builder»

Si en **Facturación → Créditos** ves *Trial credit for GenAI App Builder* (p. ej. 1.000 USD), activa el modo trial en la app para que el consumo encaje con ese crédito y no con tarjeta / AI Studio.

## Activación

En `.env.local` (y en Vercel en producción):

```bash
USE_GENAI_APP_BUILDER_TRIAL_CREDIT=1

# Obligatorio: Vertex con cuenta de servicio (no API key de AI Studio)
GOOGLE_APPLICATION_CREDENTIALS=./tu-sa.json
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto
GOOGLE_CLOUD_LOCATION=us-central1
AI_PROVIDER=gemini

# Modelo barato para diseño (tokens)
TRIAL_DESIGN_GEN_MODEL=gemini-2.5-flash-lite
DESIGN_GEN_MODEL=gemini-2.5-flash-lite

# Imágenes Imagen 4 OFF por defecto en trial (gastan mucho)
# DESIGN_IMAGE_GENERATION_ENABLED=1   # solo si quieres mockups/assets
IMAGE_GEN_PROVIDER=vertex
IMAGE_GEN_ALLOW_API_KEY=0
ALLOW_GEMINI_API_KEY_FALLBACK=0
```

Comprueba la configuración:

```bash
npm run check:genai-trial
npm run check:vertex
```

## Qué hace el modo trial (`USE_GENAI_APP_BUILDER_TRIAL_CREDIT=1`)

| Comportamiento | Motivo |
|----------------|--------|
| Texto de diseño vía **Vertex** (`generateContent`) | Elegible para SKUs Vertex / Gen AI; no usa AI Studio |
| **Sin** API keys `GEMINI_API_KEY` / `IMAGE_GEN_*` | Esas llamadas facturan fuera del crédito trial |
| **Agent Engine** solo si defines `DESIGN_AGENT_STUDIO_ENGINE` | Sin variable → orquestación en código; con variable → agente ADK (`run_orchestration`) |
| **Imagen automática desactivada** por defecto | Imagen 4 consume crédito muy rápido |
| Modelo por defecto `gemini-2.5-flash-lite` | Menor coste por generación |

## Qué NO cubre el crédito (según documentación y foros de Google)

- Llamadas **Gemini API** con clave de [AI Studio](https://aistudio.google.com) (facturan a método de pago).
- Algunos productos **Discovery Engine / Search** tienen SKUs propios; el diseño de Studio usa **Vertex Gemini**, no Search.

Confirma en **Facturación → Informes → Filtrar por SKU** que los cargos aparecen bajo *Vertex AI* / *Generative AI* y que el crédito se aplica.

## Agent Studio

- **Consola** Agent Studio (probar prompts): sin cambios; es la UI de Google.
- **Agent Engine desplegado** (`DESIGN_AGENT_STUDIO_ENGINE`): si está definido, la app usa `run_orchestration` del agente ADK (tokens → layout → assets); el HTML y el lienzo siguen en la app. Si no está definido, todo el pipeline corre en `src/lib/design/orchestration.ts`.

## Relación con otros créditos

| Crédito | Uso típico en Runlabs42 |
|---------|-------------------------|
| Trial GenAI App Builder | Vertex Gemini diseño/chat (con `USE_GENAI_APP_BUILDER_TRIAL_CREDIT=1`) |
| Google Cloud Free Trial ($300) | Infra (GCS staging, etc.) si aplica |
| Stripe / créditos de producto | Usuarios finales de la app |

## APIs a tener habilitadas

En el proyecto GCP:

- [Vertex AI API](https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/)
- Cuenta de servicio con rol **Vertex AI User**

Opcional (solo si activas imágenes): cuota de **Imagen** en el mismo proyecto.
