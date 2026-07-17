"""
Personalized recommendation API for the daily AI Legal Advisor.

This adds one read-only endpoint and keeps the contract analysis APIs unchanged.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models.contract import Contract, User
from swarm.agents.recommendation import run_recommendation_agent

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/recommendations")
async def get_recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Contract)
        .options(selectinload(Contract.clauses))
        .where(
            Contract.user_id == current_user.id,
            Contract.status == "complete",
        )
        .order_by(Contract.created_at.desc())
    )
    contracts = result.scalars().all()
    contracts_data = [contract_to_recommendation_input(contract) for contract in contracts]

    user_profile = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
    }
    agent_result = await run_recommendation_agent(
        contracts_data=contracts_data,
        user_id=current_user.id,
        user_profile=user_profile,
        company_profile=None,
    )

    return {
        "agent": agent_result.to_dict(),
        **agent_result.output,
    }


def contract_to_recommendation_input(contract: Contract) -> dict[str, Any]:
    return {
        "id": contract.id,
        "filename": contract.filename,
        "original_filename": contract.original_filename,
        "contract_type": contract.contract_type,
        "risk_level": contract.risk_level,
        "aggregate_risk_index": contract.aggregate_risk_index,
        "contradictions_json": contract.contradictions_json or [],
        "clauses": [
            {
                "id": clause.id,
                "clause_type": clause.clause_type,
                "category": clause.category,
                "risk_level": clause.risk_level,
                "risk_score": clause.risk_score,
                "why_risky": clause.why_risky,
            }
            for clause in contract.clauses
        ],
    }
