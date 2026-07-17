"""
Litigation Prediction Team — wraps services.contradiction_detector only.

Output package (for Chief Review Board): findings, confidence, evidence, reasoning_summary.
"""

from __future__ import annotations

from typing import Any

from services.contradiction_detector import detect_contradictions
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Litigation Prediction Team"
SPECIALIZATION = "Detects internal contradictions that create dispute / enforcement risk"


async def run_litigation_prediction(context: dict[str, Any]) -> AgentResult:
    async def work():
        scored_clauses = context.get("scored_clauses") or []
        contradictions = detect_contradictions(scored_clauses)
        high = sum(1 for c in contradictions if c.get("severity") == "high")

        findings = [
            {
                "id": f"lit-{i}",
                "clause_type": c.get("clause_a"),
                "related_types": [c.get("clause_a"), c.get("clause_b")],
                "severity": c.get("severity"),
                "summary": c.get("description"),
                "category": c.get("category"),
            }
            for i, c in enumerate(contradictions)
        ]
        evidence = [
            {
                "clause_type": f"{c.get('clause_a')} vs {c.get('clause_b')}",
                "detail": c.get("description"),
                "risk_level": c.get("severity"),
            }
            for c in contradictions
        ]

        reasoning = (
            f"Ran detect_contradictions on {len(scored_clauses)} clause(s); "
            f"found {len(contradictions)} issue(s) ({high} high-severity)."
        )
        confidence = 0.8 if scored_clauses else 0.4
        if contradictions:
            confidence = min(0.9, confidence + 0.05)

        output = {
            "findings": findings,
            "confidence": confidence,
            "evidence": evidence,
            "reasoning_summary": reasoning,
            "contradictions": contradictions,
            "contradiction_count": len(contradictions),
            "high_severity_count": high,
        }
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Clause Analysis Team"],
        work=work,
    )
