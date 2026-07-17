"""Chief Legal Officer — coordination plan only (no document analysis)."""

from __future__ import annotations

from typing import Any

from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Chief Legal Officer"
SPECIALIZATION = "Coordinates the legal-organization workflow; does not analyze clauses"


async def run_chief_legal_officer(context: dict[str, Any]) -> AgentResult:
    async def work():
        plan = {
            "waves": [
                [TEAM_NAME],
                ["Document Intelligence Team"],
                ["Contract Classification Team"],
                ["Clause Analysis Team"],
                [
                    "Financial Risk Team",
                    "Privacy / Compliance Team",
                    "Litigation Prediction Team",
                ],
                ["Chief Review Board"],
            ],
            "contract_id": context.get("contract_id"),
            "file_path": context.get("file_path"),
            "parallel_wave": [
                "Financial Risk Team",
                "Privacy / Compliance Team",
                "Litigation Prediction Team",
            ],
        }
        reasoning = (
            "Opened matter and scheduled sequential intake (document → classify → clauses), "
            "then a real parallel specialist wave on scored clauses, then Chief Review Board."
        )
        return plan, reasoning, 1.0

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=[],
        work=work,
    )
