"""Contract Classification Team — wraps rag_engine.detect_contract_type only."""

from __future__ import annotations

from typing import Any

from services.rag_engine import RAGEngine
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Contract Classification Team"
SPECIALIZATION = "Detects contract type via existing RAG keyword classifier"


async def run_contract_classification(context: dict[str, Any]) -> AgentResult:
    async def work():
        full_text = context["full_text"]
        # Existing implementation — no logic copied here.
        contract_type = RAGEngine.detect_contract_type(full_text)
        output = {"contract_type": contract_type}
        reasoning = f"Classified agreement as '{contract_type}' using RAGEngine.detect_contract_type."
        return output, reasoning, 0.85

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Document Intelligence Team"],
        work=work,
    )
