"""
Clause Analysis Team — wraps existing clause extraction + whole-contract scoring.

Extraction: services.orchestrator.extract_clauses_with_groq (uses groq_client + RAG fallback).
Scoring: services.risk_scorer.score_clauses / compute_cri / classify_cri
  (LexGuard scores the full clause set once here so parallel specialists share one scored set.
   Financial Risk Team still calls risk_scorer for category-focused aggregates.)
"""

from __future__ import annotations

from typing import Any

from services.risk_scorer import classify_cri, compute_cri, score_clauses
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Clause Analysis Team"
SPECIALIZATION = "Extracts clauses via Groq/RAG and applies LexGuard risk scoring"


async def run_clause_analysis(context: dict[str, Any]) -> AgentResult:
    async def work():
        # Lazy import avoids circular import with services.orchestrator → swarm bridge.
        from services.orchestrator import extract_clauses_with_groq

        full_text = context["full_text"]
        contract_type = context["contract_type"]

        # Existing implementations — wrappers do not reimplement extraction/scoring math.
        raw_clauses = await extract_clauses_with_groq(full_text)
        scored_clauses = score_clauses(raw_clauses, contract_type=contract_type)
        cri = compute_cri(scored_clauses, contract_type=contract_type)
        risk_level = classify_cri(cri)
        high_count = sum(1 for c in scored_clauses if c.get("risk_level") == "high")
        moderate_count = sum(1 for c in scored_clauses if c.get("risk_level") == "moderate")
        low_count = sum(1 for c in scored_clauses if c.get("risk_level") == "low")

        output = {
            "raw_clauses": raw_clauses,
            "scored_clauses": scored_clauses,
            "cri": cri,
            "risk_level": risk_level,
            "high_count": high_count,
            "moderate_count": moderate_count,
            "low_count": low_count,
        }
        reasoning = (
            f"Extracted {len(scored_clauses)} clause(s); overall CRI {cri:.0f}/100 ({risk_level}). "
            f"Counts high/moderate/low = {high_count}/{moderate_count}/{low_count}."
        )
        confidence = 0.8 if scored_clauses else 0.4
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Contract Classification Team"],
        work=work,
    )
