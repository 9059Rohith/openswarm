"""
orchestrator_bridge.py — THE ONLY orchestration module for LexGuard's legal org.

PLACEHOLDER ADAPTER (option b) — not a custom multi-agent framework.
Each team wrapper calls existing LexGuard services. This file only sequences waves.

================================================================================
OPENSWARM_SWAP (tomorrow / official SDK):
  Replace the sequential + asyncio.gather calls below with official OpenSwarm
  Agent lifecycle / messaging / parallel fan-out primitives.
  Keep the same team names and AgentResult envelope so UI/status stay stable.
  Ideal swap shape (illustrative — replace with real SDK signatures when available):

    # from openswarm import Agent, Swarm  # official package TBD
    # swarm = Swarm(agents=[...])
    # await swarm.run(matter_context)

  Until then, this placeholder uses plain asyncio — labeled honestly.
================================================================================
"""

from __future__ import annotations

import asyncio
from typing import Any

from swarm.agents.chief_legal_officer import run_chief_legal_officer
from swarm.agents.chief_review_board import run_chief_review_board
from swarm.agents.clause_analysis import run_clause_analysis
from swarm.agents.contract_classification import run_contract_classification
from swarm.agents.document_intelligence import run_document_intelligence
from swarm.agents.financial_risk import run_financial_risk
from swarm.agents.litigation_prediction import run_litigation_prediction
from swarm.agents.privacy_compliance import run_privacy_compliance
from swarm.types import AgentResult, MatterResult
from swarm import status_store


async def run_matter(contract_id: str, file_path: str) -> MatterResult:
    """
    Run the AI Legal Organization workflow and return persistence-ready fields.

    External callers should remain services.orchestrator.run_analysis_pipeline
    (signature unchanged for routers).
    """
    context: dict[str, Any] = {
        "contract_id": contract_id,
        "file_path": file_path,
    }
    team_results: list[AgentResult] = []

    # ── Initialize real-time status tracking ─────────────────────────────────
    _init_swarm_tracking(contract_id)

    # ── Wave 0: Chief Legal Officer (plan only) ─────────────────────────────
    # OPENSWARM_SWAP: swarm.start(chief_legal_officer) / native planner agent
    _mark_running(contract_id, "Chief Legal Officer")
    clo = await run_chief_legal_officer(context)
    team_results.append(clo)
    _update_from_result(contract_id, clo)
    _raise_if_failed(clo)

    # ── Wave 1: Document Intelligence ───────────────────────────────────────
    # OPENSWARM_SWAP: await openswarm.run(document_intelligence_agent, context)
    _mark_running(contract_id, "Document Intelligence Team")
    doc = await run_document_intelligence(context)
    team_results.append(doc)
    _update_from_result(contract_id, doc)
    _raise_if_failed(doc)
    context.update(doc.output)

    # ── Wave 2: Contract Classification ─────────────────────────────────────
    # OPENSWARM_SWAP: await openswarm.run(classification_agent, context)
    _mark_running(contract_id, "Contract Classification Team")
    classification = await run_contract_classification(context)
    team_results.append(classification)
    _update_from_result(contract_id, classification)
    _raise_if_failed(classification)
    context.update(classification.output)

    # ── Wave 3: Clause Analysis ─────────────────────────────────────────────
    # OPENSWARM_SWAP: await openswarm.run(clause_analysis_agent, context)
    _mark_running(contract_id, "Clause Analysis Team")
    clauses = await run_clause_analysis(context)
    team_results.append(clauses)
    _update_from_result(contract_id, clauses)
    _raise_if_failed(clauses)
    context.update(clauses.output)

    # ── Wave 4: REAL parallel specialists (shared dependency: scored_clauses) ─
    # OPENSWARM_SWAP: replace asyncio.gather with OpenSwarm parallel fan-out /
    #                 native multi-agent concurrent execution API.
    _mark_running(contract_id, "Financial Risk Team")
    _mark_running(contract_id, "Privacy / Compliance Team")
    _mark_running(contract_id, "Litigation Prediction Team")
    financial_t, privacy_t, litigation_t = await asyncio.gather(
        run_financial_risk(context),
        run_privacy_compliance(context),
        run_litigation_prediction(context),
    )
    team_results.extend([financial_t, privacy_t, litigation_t])
    _update_from_result(contract_id, financial_t)
    _update_from_result(contract_id, privacy_t)
    _update_from_result(contract_id, litigation_t)
    _raise_if_failed(financial_t)
    _raise_if_failed(privacy_t)
    _raise_if_failed(litigation_t)

    context["financial_output"] = financial_t.output
    context["privacy_output"] = privacy_t.output
    context["litigation_output"] = litigation_t.output
    context["contradictions"] = litigation_t.output.get("contradictions") or []
    # Pass AgentResult.confidence as backup if output package omitted it
    context["financial_confidence"] = financial_t.confidence
    context["privacy_confidence"] = privacy_t.confidence
    context["litigation_confidence"] = litigation_t.confidence

    # ── Wave 5: Chief Review Board (waits for all three specialists) ────────
    # OPENSWARM_SWAP: await openswarm.run(chief_review_board_agent, context)
    #                 after join/barrier on parallel wave.
    # Stage 3: Board applies deterministic cross-team rules (swarm.review_rules)
    # before producing consensus recommendation + executive summary.
    _mark_running(contract_id, "Chief Review Board")
    review = await run_chief_review_board(context)
    team_results.append(review)
    _update_from_result(contract_id, review)
    _raise_if_failed(review)

    # Prefer Board-adjusted risk / clauses so persisted API fields reflect consensus.
    scored = review.output.get("scored_clauses") or context.get("scored_clauses") or []
    cri = float(review.output.get("effective_cri", context.get("cri") or 0))
    risk_level = (
        review.output.get("effective_risk_level")
        or context.get("risk_level")
        or "moderate"
    )

    # ── Store final team results for frontend ────────────────────────────────
    status_store.store_final_results(
        contract_id,
        [r.to_dict() for r in team_results],
    )

    return MatterResult(
        full_text=context.get("full_text") or "",
        page_count=int(context.get("page_count") or 0),
        bounding_boxes=context.get("bounding_boxes") or [],
        counterparty=context.get("counterparty") or "",
        jurisdiction=context.get("jurisdiction") or "",
        contract_type=context.get("contract_type") or "",
        scored_clauses=scored,
        cri=cri,
        risk_level=risk_level,
        high_count=int(review.output.get("high_count", context.get("high_count") or 0)),
        moderate_count=int(
            review.output.get("moderate_count", context.get("moderate_count") or 0)
        ),
        low_count=int(review.output.get("low_count", context.get("low_count") or 0)),
        contradictions=context.get("contradictions") or [],
        scenarios=review.output.get("scenarios") or [],
        executive_summary=review.output.get("executive_summary") or "",
        team_results=team_results,
    )


def _raise_if_failed(result: AgentResult) -> None:
    if result.status == "failed":
        raise RuntimeError(result.error or f"{result.team_name} failed")


# ── Status tracking helpers (thin wrappers around status_store) ──────────────

def _init_swarm_tracking(contract_id: str) -> None:
    """Initialize the status store with all team definitions in 'waiting' state."""
    teams = [
        {"team_name": "Chief Legal Officer", "status": "waiting", "specialization": "Orchestrates and plans the legal review strategy", "dependencies": [], "wave": 0},
        {"team_name": "Document Intelligence Team", "status": "waiting", "specialization": "Parses document structure, extracts text and layout metadata", "dependencies": ["Chief Legal Officer"], "wave": 1},
        {"team_name": "Contract Classification Team", "status": "waiting", "specialization": "Identifies contract type, counterparty, and governing jurisdiction", "dependencies": ["Document Intelligence Team"], "wave": 2},
        {"team_name": "Clause Analysis Team", "status": "waiting", "specialization": "Extracts and risk-scores every clause using multi-model AI", "dependencies": ["Contract Classification Team"], "wave": 3},
        {"team_name": "Financial Risk Team", "status": "waiting", "specialization": "Analyzes financial exposure, liability caps, and payment terms", "dependencies": ["Clause Analysis Team"], "wave": 4, "parallel_group": "specialists"},
        {"team_name": "Privacy / Compliance Team", "status": "waiting", "specialization": "Evaluates data protection clauses and regulatory compliance", "dependencies": ["Clause Analysis Team"], "wave": 4, "parallel_group": "specialists"},
        {"team_name": "Litigation Prediction Team", "status": "waiting", "specialization": "Detects contradictions and predicts litigation exposure", "dependencies": ["Clause Analysis Team"], "wave": 4, "parallel_group": "specialists"},
        {"team_name": "Chief Review Board", "status": "waiting", "specialization": "Cross-team consensus review with deterministic reasoning rules", "dependencies": ["Financial Risk Team", "Privacy / Compliance Team", "Litigation Prediction Team"], "wave": 5},
    ]
    status_store.init_contract(contract_id, teams)


def _mark_running(contract_id: str, team_name: str) -> None:
    """Mark a team as 'running'."""
    import time
    status_store.update_team(contract_id, team_name, status="running", start_time=time.time())


def _update_from_result(contract_id: str, result: AgentResult) -> None:
    """Update a team from its AgentResult after completion."""
    status_store.update_team(
        contract_id,
        result.team_name,
        status=result.status,
        duration=result.duration,
        confidence=result.confidence,
        reasoning_summary=result.reasoning_summary,
        end_time=result.end_time,
    )
