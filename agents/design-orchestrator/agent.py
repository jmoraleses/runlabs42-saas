"""Entrada local; en producción Vertex usa orchestrator_agent.py."""

import orchestrator_agent

DesignOrchestratorAgent = orchestrator_agent.DesignOrchestratorAgent
create_agent = orchestrator_agent.create_agent

__all__ = ["DesignOrchestratorAgent", "create_agent"]

if __name__ == "__main__":
    import json

    agent = create_agent()
    sample = agent.run_orchestration(
        brief={"prompt": "Tienda de tortugas premium", "siteType": "ecommerce"},
        model_id="gemini-3.1-flash-lite",
    )
    print(json.dumps({k: v for k, v in sample.items() if k != "events"}, indent=2))
    print("events:", len(sample.get("events", [])))
