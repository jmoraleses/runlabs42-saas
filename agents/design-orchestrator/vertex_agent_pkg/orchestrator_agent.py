"""
Orquestador de diseño para Vertex AI Agent Engine (módulo único orchestrator_agent).

Sin imports de google.genai a nivel de módulo (pickle-safe).
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

VISUAL_IDENTITY_INSTRUCTION = """Eres un director de arte digital. Genera tokens de diseño únicos en JSON.
Prohibido reutilizar paletas o tipografías genéricas de plantilla SaaS.
Responde SOLO JSON válido sin markdown."""

LAYOUT_INSTRUCTION_DESKTOP = """Eres un arquitecto de información web vanguardista.
Diseña layouts modulares únicos por página. Rompe el patrón navigation→hero→features→footer.
Incluye layoutStrategy por página y secciones con type, composition, style, description.
Responde SOLO JSON: {"pages":[...]} sin markdown."""

ASSET_PLANNER_INSTRUCTION = """Planifica assets visuales únicos para el sitio (hero, logo, texturas).
Prioriza identidad de marca; no listes decenas de imágenes genéricas.
Responde SOLO JSON: {"assets":[{"path":"assets/...","prompt":"...","aspect":"16:9","priority":"hero|logo|texture|other"}]}"""


def _genai_client():
    from google import genai

    project = os.environ.get("GOOGLE_CLOUD_PROJECT_ID") or os.environ.get(
        "GOOGLE_CLOUD_PROJECT"
    )
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    return genai.Client(vertexai=True, project=project, location=location)


def _extract_json(text: str) -> dict[str, Any] | None:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(raw[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _generate_text(
    *,
    prompt: str,
    system_instruction: str,
    model_id: str,
    response_mime_type: str | None = None,
    image_parts: list[dict[str, str]] | None = None,
) -> str:
    from google.genai import types

    config: dict[str, Any] = {}
    if system_instruction:
        config["system_instruction"] = system_instruction
    if response_mime_type:
        config["response_mime_type"] = response_mime_type

    contents: Any = prompt
    if image_parts:
        parts: list[Any] = [
            types.Part(
                text="REFERENCIA VISUAL: analiza la captura antes de responder."
            )
        ]
        import base64

        for img in image_parts:
            mime = img.get("mimeType") or img.get("mime_type") or "image/png"
            data = img.get("data") or ""
            if data:
                raw = base64.b64decode(data) if isinstance(data, str) else data
                parts.append(
                    types.Part(inline_data=types.Blob(mime_type=mime, data=raw))
                )
        parts.append(types.Part(text=prompt))
        contents = parts

    # No usar _genai_client().models... en una línea: el Client se cierra al salir del scope.
    client = _genai_client()
    response = client.models.generate_content(
        model=model_id,
        contents=contents,
        config=types.GenerateContentConfig(**config) if config else None,
    )
    text = getattr(response, "text", None) or ""
    if not text and response.candidates:
        parts = response.candidates[0].content.parts
        text = "".join(getattr(p, "text", "") or "" for p in parts)
    return text


def _layout_is_generic(layout_json: str) -> str | None:
    try:
        data = json.loads(layout_json)
        pages = data.get("pages") if isinstance(data, dict) else None
        if not isinstance(pages, list) or not pages:
            return "Sin páginas en el layout"
        home = next((p for p in pages if p.get("id") == "home"), pages[0])
        sections = home.get("sections") if isinstance(home, dict) else []
        if not isinstance(sections, list):
            return None
        types_lower = [str(s.get("type", "")).lower() for s in sections if isinstance(s, dict)]
        if (
            "navigation" in types_lower
            and "hero" in types_lower
            and any(t in types_lower for t in ("features", "feature-grid", "features-grid"))
        ):
            nav_i = types_lower.index("navigation")
            hero_i = types_lower.index("hero")
            feat_i = next(
                i
                for i, t in enumerate(types_lower)
                if t in ("features", "feature-grid", "features-grid")
            )
            if nav_i < hero_i < feat_i:
                return "Patrón genérico navigation → hero → features"
    except json.JSONDecodeError:
        return "Layout JSON inválido"
    return None


def _compose_user_prompt(brief: dict[str, Any], extra: list[str] | None = None) -> str:
    parts = [f"## Prompt\n{brief.get('prompt', '')}"]
    if brief.get("layoutTopology"):
        parts.append(f"## Topología (auditoría visual)\n{brief['layoutTopology']}")
    section_types = brief.get("sectionTypes")
    if isinstance(section_types, list) and section_types:
        parts.append(
            "## Secciones visibles en captura\n"
            + " → ".join(str(s) for s in section_types)
        )
    colors = brief.get("dominantColors")
    if isinstance(colors, list) and colors:
        parts.append("## Colores dominantes (captura)\n" + ", ".join(str(c) for c in colors))
    if brief.get("brandName"):
        parts.append(f"## Marca en captura\n{brief['brandName']}")
    if brief.get("siteType"):
        parts.append(f"## Tipo de sitio\n{brief['siteType']}")
    if brief.get("brandTone"):
        parts.append(f"## Tono de marca\n{brief['brandTone']}")
    if brief.get("businessModel"):
        parts.append(f"## Modelo de negocio\n{brief['businessModel']}")
    if brief.get("requiredSections"):
        sections = brief["requiredSections"]
        if isinstance(sections, list) and sections:
            parts.append("## Secciones requeridas\n" + ", ".join(str(s) for s in sections))
    if extra:
        parts.extend(extra)
    return "\n\n".join(parts)


class DesignOrchestratorAgent:
    """Orquestador modular: tokens → layout → assets (HTML lo hace la app web)."""

    def register_operations(self) -> dict[str, list[str]]:
        return {
            "": ["query", "run_orchestration"],
        }

    def _tool_generate_tokens(self, brief: dict[str, Any], model_id: str) -> str:
        text = _generate_text(
            prompt=_compose_user_prompt(brief),
            system_instruction=VISUAL_IDENTITY_INSTRUCTION,
            model_id=model_id,
            response_mime_type="application/json",
        )
        parsed = _extract_json(text)
        return json.dumps(parsed) if parsed else text

    def _layout_instruction_for_brief(self, brief: dict[str, Any]) -> str:
        topo = str(brief.get("layoutTopology") or "").lower()
        if "ecommerce" in topo or "catalog" in topo:
            return (
                LAYOUT_INSTRUCTION_DESKTOP
                + "\nLa captura es catálogo e-commerce: incluye catalog-sidebar/filters-panel y product-grid. "
                "PROHIBIDO navigation→hero→features de landing genérica."
            )
        return LAYOUT_INSTRUCTION_DESKTOP

    def _tool_generate_layout(
        self,
        brief: dict[str, Any],
        tokens_json: str,
        model_id: str,
        correction: str | None = None,
    ) -> str:
        extra = [f"## Tokens\n{tokens_json}"]
        if correction:
            extra.append(f"## Corrección obligatoria\n{correction}")
        text = _generate_text(
            prompt=_compose_user_prompt(brief, extra),
            system_instruction=self._layout_instruction_for_brief(brief),
            model_id=model_id,
            response_mime_type="application/json",
        )
        parsed = _extract_json(text)
        if parsed and "pages" in parsed:
            return json.dumps(parsed)
        return text

    def _tool_plan_assets(
        self, brief: dict[str, Any], tokens_json: str, layout_json: str, model_id: str
    ) -> str:
        text = _generate_text(
            prompt=_compose_user_prompt(
                brief,
                [f"## Tokens\n{tokens_json}", f"## Layout\n{layout_json}"],
            ),
            system_instruction=ASSET_PLANNER_INSTRUCTION,
            model_id=model_id,
            response_mime_type="application/json",
        )
        parsed = _extract_json(text)
        return json.dumps(parsed) if parsed else text

    def run_orchestration(
        self,
        *,
        brief: dict[str, Any] | None = None,
        model_id: str | None = None,
        device: str = "desktop",
        prompt: str | None = None,
    ) -> dict[str, Any]:
        merged_brief: dict[str, Any] = dict(brief or {})
        if prompt and not merged_brief.get("prompt"):
            merged_brief["prompt"] = prompt
        model = model_id or os.environ.get("DESIGN_GEN_MODEL", "gemini-2.5-flash")
        events: list[dict[str, str]] = []

        if merged_brief.get("layoutTopology"):
            events.append({"type": "phase", "data": "visual-audit-ready"})
        events.append({"type": "phase", "data": "visual-identity"})
        tokens_json = self._tool_generate_tokens(merged_brief, model)
        events.append({"type": "tokens_ready", "data": tokens_json})

        events.append({"type": "phase", "data": "layout-planning"})
        layout_json = self._tool_generate_layout(merged_brief, tokens_json, model)
        generic = _layout_is_generic(layout_json)
        if generic:
            layout_json = self._tool_generate_layout(
                merged_brief,
                tokens_json,
                model,
                correction=f"{generic}. Propón estructura distinta.",
            )
        events.append({"type": "layout_ready", "data": layout_json})

        events.append({"type": "phase", "data": "asset-planning"})
        asset_plan_json = self._tool_plan_assets(
            merged_brief, tokens_json, layout_json, model
        )
        events.append({"type": "assets_planned", "data": asset_plan_json})

        return {
            "events": events,
            "tokens_json": tokens_json,
            "layout_json": layout_json,
            "asset_plan_json": asset_plan_json,
            "model_id": model,
            "device": device,
        }

    def query(
        self,
        *,
        phase: str = "text",
        prompt: str,
        system_instruction: str = "",
        response_mime_type: str | None = None,
        model_id: str | None = None,
    ) -> dict[str, Any]:
        model = model_id or os.environ.get("DESIGN_GEN_MODEL", "gemini-2.5-flash")
        text = _generate_text(
            prompt=prompt,
            system_instruction=system_instruction,
            model_id=model,
            response_mime_type=response_mime_type,
        )
        return {"phase": phase, "text": text, "model": model}


def create_agent() -> DesignOrchestratorAgent:
    return DesignOrchestratorAgent()
