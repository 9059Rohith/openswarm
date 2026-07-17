"""
Swarm status API — lightweight endpoint for frontend team visualization.

New router. Does NOT modify any existing router or endpoint.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.contract import User
from auth import get_current_user
from swarm import status_store

router = APIRouter(prefix="/api/swarm", tags=["swarm"])


# ── Default team definitions (used for initializing + providing static info) ──
TEAM_DEFINITIONS = [
    {
        "team_name": "Chief Legal Officer",
        "specialization": "Orchestrates and plans the legal review strategy",
        "dependencies": [],
        "wave": 0,
    },
    {
        "team_name": "Document Intelligence Team",
        "specialization": "Parses document structure, extracts text and layout metadata",
        "dependencies": ["Chief Legal Officer"],
        "wave": 1,
    },
    {
        "team_name": "Contract Classification Team",
        "specialization": "Identifies contract type, counterparty, and governing jurisdiction",
        "dependencies": ["Document Intelligence Team"],
        "wave": 2,
    },
    {
        "team_name": "Clause Analysis Team",
        "specialization": "Extracts and risk-scores every clause using multi-model AI",
        "dependencies": ["Contract Classification Team"],
        "wave": 3,
    },
    {
        "team_name": "Financial Risk Team",
        "specialization": "Analyzes financial exposure, liability caps, and payment terms",
        "dependencies": ["Clause Analysis Team"],
        "wave": 4,
        "parallel_group": "specialists",
    },
    {
        "team_name": "Privacy / Compliance Team",
        "specialization": "Evaluates data protection clauses and regulatory compliance",
        "dependencies": ["Clause Analysis Team"],
        "wave": 4,
        "parallel_group": "specialists",
    },
    {
        "team_name": "Litigation Prediction Team",
        "specialization": "Detects contradictions and predicts litigation exposure",
        "dependencies": ["Clause Analysis Team"],
        "wave": 4,
        "parallel_group": "specialists",
    },
    {
        "team_name": "Chief Review Board",
        "specialization": "Cross-team consensus review with deterministic reasoning rules",
        "dependencies": [
            "Financial Risk Team",
            "Privacy / Compliance Team",
            "Litigation Prediction Team",
        ],
        "wave": 5,
    },
]


@router.get("/status/{contract_id}")
async def get_swarm_status(
    contract_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Return current swarm team status for a contract.

    If no in-memory status exists (analysis already complete or not started),
    returns the static team definitions with 'waiting' status so the frontend
    can render the organization chart.
    """
    live = status_store.get_status(contract_id)

    if live and live.get("final_results"):
        # Analysis is done — serve finalized team results
        return {
            "contract_id": contract_id,
            "swarm_status": "complete",
            "teams": live["final_results"],
            "final_results": live["final_results"],
            "team_definitions": TEAM_DEFINITIONS,
        }

    if live:
        # Analysis in progress — serve live statuses
        return {
            "contract_id": contract_id,
            "swarm_status": live["status"],
            "teams": live["teams"],
            "team_definitions": TEAM_DEFINITIONS,
        }

    # No live data — return static definitions (for completed contracts)
    return {
        "contract_id": contract_id,
        "swarm_status": "idle",
        "teams": [],
        "team_definitions": TEAM_DEFINITIONS,
    }
