"""
Despliega DesignOrchestratorAgent en Vertex AI Agent Engine.

- Primera vez: agent_engines.create() → nuevo reasoning engine.
- Siguientes deploys: agent_engines.update() sobre DESIGN_AGENT_STUDIO_ENGINE
  (mismo resource name, sin duplicar orquestadores en GCP).
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

import vertexai
from vertexai import agent_engines

_AGENT_ROOT = Path(__file__).resolve().parent
_PKG_ROOT = _AGENT_ROOT / "vertex_agent_pkg"
_STAGING = _AGENT_ROOT / "deploy_staging"
_DIST = _AGENT_ROOT / "dist"
_INSTALL_SCRIPT = "installation_scripts/install_orchestrator.sh"


def _build_wheel() -> Path:
    _DIST.mkdir(exist_ok=True)
    subprocess.run(
        [sys.executable, "-m", "pip", "wheel", ".", "-w", str(_DIST), "--no-deps", "-q"],
        cwd=_AGENT_ROOT,
        check=True,
    )
    wheels = sorted(_DIST.glob("*.whl"), key=lambda p: p.stat().st_mtime)
    if not wheels:
        raise SystemExit("No se generó ningún .whl en agents/design-orchestrator/dist")
    return wheels[-1]


def _prepare_staging(wheel: Path) -> list[str]:
    if _STAGING.exists():
        shutil.rmtree(_STAGING)
    wheels_dir = _STAGING / "wheels"
    scripts_dir = _STAGING / "installation_scripts"
    wheels_dir.mkdir(parents=True)
    scripts_dir.mkdir(parents=True)

    shutil.copy2(_PKG_ROOT / "orchestrator_agent.py", _STAGING / "orchestrator_agent.py")
    shutil.copy2(wheel, wheels_dir / wheel.name)
    shutil.copy2(
        _AGENT_ROOT / "installation_scripts" / "install_orchestrator.sh",
        _STAGING / _INSTALL_SCRIPT,
    )
    install_path = _STAGING / _INSTALL_SCRIPT
    install_path.chmod(install_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    return [
        "orchestrator_agent.py",
        _INSTALL_SCRIPT,
        f"wheels/{wheel.name}",
    ]


def _normalize_engine_resource(*, project: str, location: str) -> str | None:
    raw = (
        os.environ.get("DESIGN_AGENT_STUDIO_ENGINE", "").strip()
        or os.environ.get("VERTEX_DESIGN_REASONING_ENGINE", "").strip()
    )
    if not raw:
        log_path = _AGENT_ROOT.parent.parent / ".deploy-design-agent-last.log"
        try:
            raw = log_path.read_text(encoding="utf-8").strip().splitlines()[0].strip()
        except (OSError, IndexError):
            return None

    if raw.startswith("projects/"):
        return raw
    return f"projects/{project}/locations/{location}/reasoningEngines/{raw}"


def _existing_engine_or_none(resource_name: str) -> str | None:
    try:
        agent_engines.get(resource_name)
        return resource_name
    except Exception:
        return None


def main() -> None:
    project = os.environ.get("GOOGLE_CLOUD_PROJECT_ID") or os.environ.get(
        "GOOGLE_CLOUD_PROJECT"
    )
    if not project:
        raise SystemExit("Define GOOGLE_CLOUD_PROJECT_ID")

    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    staging_bucket = os.environ.get(
        "AGENT_ENGINE_STAGING_BUCKET",
        f"gs://{project}-agent-engine-staging",
    )

    wheel = _build_wheel()
    print(f"Wheel: {wheel.name}")
    extra_packages = _prepare_staging(wheel)
    print(f"Staging: {len(extra_packages)} artefactos en deploy_staging/")

    sys.path.insert(0, str(_STAGING))
    import orchestrator_agent

    vertexai.init(project=project, location=location, staging_bucket=staging_bucket)

    deploy_kwargs = dict(
        agent_engine=orchestrator_agent.DesignOrchestratorAgent(),
        requirements=[
            "google-cloud-aiplatform[agent_engines]>=1.88.0",
            "google-genai>=1.0.0",
            "cloudpickle>=3.0.0",
            "pydantic>=2.0.0",
        ],
        extra_packages=extra_packages,
        build_options={
            "installation_scripts": [_INSTALL_SCRIPT],
        },
        env_vars={
            "GOOGLE_CLOUD_PROJECT_ID": project,
            "GOOGLE_CLOUD_LOCATION": location,
            "DESIGN_GEN_MODEL": os.environ.get("DESIGN_GEN_MODEL", "gemini-3.1-flash-lite"),
        },
        display_name="spec-design-orchestrator",
        description="Orquestador modular de diseño web (tokens, layout, assets).",
    )

    normalized = _normalize_engine_resource(project=project, location=location)
    existing = _existing_engine_or_none(normalized) if normalized else None

    previous_cwd = Path.cwd()
    os.chdir(_STAGING)
    try:
        if existing:
            print(f"Actualizando Agent Engine existente:\n  {existing}")
            remote = agent_engines.update(resource_name=existing, **deploy_kwargs)
        else:
            print("Creando nuevo Agent Engine (no hay DESIGN_AGENT_STUDIO_ENGINE previo)…")
            remote = agent_engines.create(**deploy_kwargs)
    finally:
        os.chdir(previous_cwd)

    resource_name = remote.resource_name
    print("Reasoning engine resource:")
    print(resource_name)

    log_path = _AGENT_ROOT.parent.parent / ".deploy-design-agent-last.log"
    try:
        log_path.write_text(f"{resource_name}\n", encoding="utf-8")
    except OSError:
        pass


if __name__ == "__main__":
    main()
