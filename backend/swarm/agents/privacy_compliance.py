"""
Privacy / Compliance Team — filters scored clauses + risk_scorer subset aggregates.

Output package (for Chief Review Board): findings, confidence, evidence, reasoning_summary.
"""

from __future__ import annotations

from typing import Any

from services.risk_scorer import classify_cri, compute_cri
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Privacy / Compliance Team"
SPECIALIZATION = "Surfaces privacy, confidentiality, and compliance obligations from scored clauses"

_PRIVACY_COMPLIANCE = {
    "Privacy",
    "Compliance",
    "Privacy & Security",
    "privacy",
    "compliance",
}


async def run_privacy_compliance(context: dict[str, Any]) -> AgentResult:
    async def work():
        scored_clauses = context.get("scored_clauses") or []
        contract_type = context.get("contract_type") or ""

        subset = [
            c
            for c in scored_clauses
            if (c.get("category") or "") in _PRIVACY_COMPLIANCE
            or "confidential" in (c.get("clause_type") or "").lower()
            or "data" in (c.get("clause_type") or "").lower()
            or "privacy" in (c.get("clause_type") or "").lower()
            or "gdpr" in (c.get("raw_text") or "").lower()
            or "gdpr" in (c.get("why_risky") or "").lower()
        ]

        subset_cri = compute_cri(subset, contract_type=contract_type) if subset else 0.0
        subset_tier = classify_cri(subset_cri) if subset else "low"
        top = sorted(
            subset,
            key=lambda c: float(c.get("risk_score_adjusted", 0)),
            reverse=True,
        )[:5]

        findings = [
            {
                "id": f"priv-{i}",
                "clause_type": c.get("clause_type"),
                "severity": c.get("risk_level"),
                "risk_level": c.get("risk_level"),
                "summary": c.get("why_risky") or c.get("plain_english") or c.get("clause_type"),
                "category": c.get("category"),
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

        if subset:
            reasoning = (
                f"Identified {len(subset)} privacy/compliance-related clause(s); "
                f"subset CRI {subset_cri:.0f}/100 ({subset_tier}) via risk_scorer."
            )
            confidence = 0.7
        else:
            reasoning = (
                "No privacy/compliance-tagged clauses in the scored set for this contract."
            )
            confidence = 0.65

        output = {
            "findings": findings,
            "confidence": confidence,
            "evidence": evidence,
            "reasoning_summary": reasoning,
            "privacy_compliance_clause_count": len(subset),
            "privacy_compliance_cri": subset_cri,
            "privacy_compliance_risk_level": subset_tier,
            "top_issues": [
                {
                    "clause_type": c.get("clause_type"),
                    "category": c.get("category"),
                    "risk_level": c.get("risk_level"),
                    "why_risky": c.get("why_risky"),
                }
                for c in top
            ],
            "note": (
                "LexGuard has no standalone privacy engine; this team filters scored clauses "
                "and reuses risk_scorer aggregates."
            ),
        }
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Clause Analysis Team"],
        work=work,
    )
