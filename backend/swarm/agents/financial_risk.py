"""
Financial Risk Team — wraps services.risk_scorer on Financial-category clauses.

Output package (for Chief Review Board): findings, confidence, evidence, reasoning_summary.
"""

from __future__ import annotations

from typing import Any

from services.risk_scorer import classify_cri, compute_cri
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Financial Risk Team"
SPECIALIZATION = "Quantifies liability and payment exposure from Financial-category clauses"

_FINANCIAL_CATEGORIES = {"Financial", "financial"}


async def run_financial_risk(context: dict[str, Any]) -> AgentResult:
    async def work():
        scored_clauses = context.get("scored_clauses") or []
        contract_type = context.get("contract_type") or ""

        financial_clauses = [
            c
            for c in scored_clauses
            if (c.get("category") or "") in _FINANCIAL_CATEGORIES
            or "liability" in (c.get("clause_type") or "").lower()
            or "payment" in (c.get("clause_type") or "").lower()
        ]

        financial_cri = (
            compute_cri(financial_clauses, contract_type=contract_type)
            if financial_clauses
            else 0.0
        )
        financial_tier = classify_cri(financial_cri) if financial_clauses else "low"
        top = sorted(
            financial_clauses,
            key=lambda c: float(c.get("risk_score_adjusted", 0)),
            reverse=True,
        )[:5]

        findings = [
            {
                "id": f"fin-{i}",
                "clause_type": c.get("clause_type"),
                "severity": c.get("risk_level"),
                "risk_level": c.get("risk_level"),
                "summary": c.get("why_risky") or c.get("plain_english") or c.get("clause_type"),
                "risk_score": c.get("risk_score"),
            }
            for i, c in enumerate(top)
        ]
        evidence = [
            {
                "clause_type": c.get("clause_type"),
                "detail": (c.get("raw_text") or c.get("why_risky") or "")[:240],
                "risk_level": c.get("risk_level"),
            }
            for c in top
        ]

        if financial_clauses:
            reasoning = (
                f"Applied risk_scorer.compute_cri to {len(financial_clauses)} Financial-focused "
                f"clause(s); subset CRI {financial_cri:.0f}/100 ({financial_tier})."
            )
            confidence = 0.75 if top else 0.65
        else:
            reasoning = (
                "No Financial-category clauses found in scored set; "
                "risk_scorer subset CRI treated as 0."
            )
            confidence = 0.7

        output = {
            "findings": findings,
            "confidence": confidence,
            "evidence": evidence,
            "reasoning_summary": reasoning,
            "financial_clause_count": len(financial_clauses),
            "financial_cri": financial_cri,
            "financial_risk_level": financial_tier,
            "top_exposures": [
                {
                    "clause_type": c.get("clause_type"),
                    "risk_level": c.get("risk_level"),
                    "risk_score": c.get("risk_score"),
                    "why_risky": c.get("why_risky"),
                }
                for c in top
            ],
        }
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Clause Analysis Team"],
        work=work,
    )
