"""
LexGuard analysis pipeline entrypoint.

External signature UNCHANGED for routers:
  run_analysis_pipeline(contract_id, file_path)

Stage 2: analysis steps are coordinated by swarm.orchestrator_bridge (placeholder
OpenSwarm-ready adapter). Existing services are unchanged; this module persists results.
"""

from typing import List

from sqlalchemy import select

from models.contract import Contract, Clause
from database import AsyncSessionLocal
from services.groq_client import groq_client
from services.prompts import CLAUSE_EXTRACTION_SYSTEM
from services.rag_engine import RAGEngine


async def extract_clauses_with_groq(full_text: str) -> List[dict]:
    """
    Use Groq LLM (llama-3.3-70b) to extract and risk-score every clause.
    Falls back to RAG rule-based extraction if LLM call fails.
    Handles long contracts by chunking: sends first 50 KB then any remainder.

    Kept here (unchanged behavior) so Clause Analysis Team can call it without
    duplicating extraction logic into swarm wrappers.
    """
    MAX_CHARS = 50_000
    text_a = full_text[:MAX_CHARS]
    text_b = full_text[MAX_CHARS:MAX_CHARS * 2] if len(full_text) > MAX_CHARS else ""

    async def _llm_extract(text: str) -> List[dict]:
        result = await groq_client.complete_json(
            CLAUSE_EXTRACTION_SYSTEM,
            f"Analyze the following contract text in full. Flag EVERY clause that is unfair, "
            f"exploitative, one-sided, or risky. Be aggressive—err on the side of flagging more.\n\n"
            f"CONTRACT TEXT:\n\n{text}",
            temperature=0.05,
            max_tokens=4096,
        )
        if isinstance(result, list):
            return result
        return []

    try:
        clauses_a = await _llm_extract(text_a)
        clauses_b = await _llm_extract(text_b) if text_b else []

        # Merge and deduplicate by raw_text similarity
        all_clauses: List[dict] = clauses_a
        seen = {c.get("raw_text", "")[:80] for c in clauses_a}
        for c in clauses_b:
            key = c.get("raw_text", "")[:80]
            if key not in seen:
                all_clauses.append(c)
                seen.add(key)

        if all_clauses:
            return all_clauses
    except Exception as e:
        print(f"[orchestrator] Groq clause extraction failed: {e}, falling back to RAG")

    # Fallback: rule-based RAG extraction
    engine = RAGEngine()
    return engine.extract_clauses(full_text)


async def update_contract_status(contract_id: str, status: str, **kwargs):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Contract).where(Contract.id == contract_id))
        contract = result.scalar_one_or_none()
        if contract:
            contract.status = status
            for key, value in kwargs.items():
                setattr(contract, key, value)
            await db.commit()


async def run_analysis_pipeline(contract_id: str, file_path: str):
    """
    Analysis pipeline entry — signature preserved for BackgroundTasks / routers.

    Stage 2: delegates coordination to swarm.orchestrator_bridge.run_matter
    (placeholder adapter). Persistence remains here so DB models stay untouched.
    """
    try:
        await update_contract_status(contract_id, "processing")

        # OPENSWARM_SWAP: tomorrow replace this import/call with official OpenSwarm
        # runner while keeping the MatterResult → DB mapping below.
        from swarm.orchestrator_bridge import run_matter

        matter = await run_matter(contract_id, file_path)

        # ── Persist (unchanged schema / fields) ─────────────────────────────
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Contract).where(Contract.id == contract_id))
            contract = result.scalar_one_or_none()
            if not contract:
                return

            contract.status = "complete"
            contract.full_text = matter.full_text
            contract.page_count = matter.page_count
            contract.contract_type = matter.contract_type
            contract.counterparty = matter.counterparty
            contract.jurisdiction = matter.jurisdiction
            contract.aggregate_risk_index = matter.cri
            contract.risk_level = matter.risk_level
            contract.high_count = matter.high_count
            contract.moderate_count = matter.moderate_count
            contract.low_count = matter.low_count
            contract.executive_summary = matter.executive_summary.strip()
            contract.scenarios_json = matter.scenarios
            contract.contradictions_json = matter.contradictions

            bboxes = matter.bounding_boxes or []

            for i, clause_data in enumerate(matter.scored_clauses):
                bbox = bboxes[i % len(bboxes)] if bboxes else None

                clause = Clause(
                    contract_id=contract_id,
                    clause_type=clause_data.get("clause_type", "Unknown")[:200],
                    raw_text=clause_data.get("raw_text", "")[:2000],
                    plain_english=clause_data.get("plain_english", ""),
                    risk_likelihood=int(clause_data.get("risk_likelihood", 3)),
                    risk_severity=int(clause_data.get("risk_severity", 3)),
                    risk_score=float(clause_data.get("risk_score", 9.0)),
                    risk_score_adjusted=float(clause_data.get("risk_score_adjusted", 9.0)),
                    requires_legal_review=bool(clause_data.get("requires_legal_review", False)),
                    risk_level=clause_data.get("risk_level", "moderate"),
                    category=clause_data.get("category", "Operational"),
                    page_estimate=int(clause_data.get("page_estimate", 1)),
                    bounding_box_json=bbox,
                    redline_suggestion=clause_data.get("redline_suggestion", ""),
                    why_risky=clause_data.get("why_risky", ""),
                    order_index=i,
                )
                db.add(clause)

            await db.commit()

    except Exception as e:
        await update_contract_status(
            contract_id, "failed", error_message=str(e)[:500]
        )
