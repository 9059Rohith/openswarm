"""
Daily legal brief API for the Daily AI Legal Assistant.

This is an additional productivity endpoint and does not change analysis APIs.
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
from routers.recommendations import contract_to_recommendation_input
from swarm.agents.daily_task import run_daily_task_agent
from swarm.agents.recommendation import run_recommendation_agent

router = APIRouter(prefix="/api", tags=["daily-brief"])


@router.get("/daily-brief")
async def get_daily_brief(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Contract)
        .options(selectinload(Contract.clauses))
        .where(Contract.user_id == current_user.id)
        .order_by(Contract.created_at.desc())
    )
    contracts = result.scalars().all()
    contracts_data = [contract_to_daily_brief_input(contract) for contract in contracts]

    completed_contracts = [contract for contract in contracts if contract.status == "complete"]
    recommendation_input = [
        contract_to_recommendation_input(contract)
        for contract in completed_contracts
    ]
    recommendation_result = await run_recommendation_agent(
        contracts_data=recommendation_input,
        user_id=current_user.id,
        user_profile={
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
        },
        company_profile=None,
    )

    daily_result = await run_daily_task_agent(
        contracts_data=contracts_data,
        recommendations=recommendation_result.output.get("recommendations", []),
        user_id=current_user.id,
    )

    return {
        "agent": daily_result.to_dict(),
        "recommendation_agent": recommendation_result.to_dict(),
        **daily_result.output,
    }


def contract_to_daily_brief_input(contract: Contract) -> dict[str, Any]:
    created_at = contract.created_at.isoformat() if contract.created_at else None
    return {
        "id": contract.id,
        "filename": contract.filename,
        "original_filename": contract.original_filename,
        "contract_type": contract.contract_type,
        "status": contract.status,
        "risk_level": contract.risk_level,
        "aggregate_risk_index": contract.aggregate_risk_index,
        "high_count": contract.high_count,
        "moderate_count": contract.moderate_count,
        "low_count": contract.low_count,
        "executive_summary": contract.executive_summary,
        "created_at": created_at,
        "contradictions_json": contract.contradictions_json or [],
        "clauses": [
            {
                "clause_type": clause.clause_type,
                "category": clause.category,
                "risk_level": clause.risk_level,
            }
            for clause in contract.clauses
        ],
    }
