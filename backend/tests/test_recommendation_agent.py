import pytest

from swarm.agents.recommendation import run_recommendation_agent


@pytest.mark.asyncio
async def test_recommendation_agent_prioritizes_recurring_issues_with_related_contract():
    contracts = [
        {
            "id": "contract-1",
            "filename": "vendor-master.pdf",
            "contract_type": "Vendor",
            "risk_level": "high",
            "aggregate_risk_index": 82,
            "clauses": [
                {
                    "clause_type": "Payment Terms",
                    "category": "Financial",
                    "risk_level": "high",
                    "risk_score": 20,
                    "why_risky": "Late payment penalties are missing.",
                }
            ],
            "contradictions_json": [],
        },
        {
            "id": "contract-2",
            "filename": "vendor-renewal.pdf",
            "contract_type": "Vendor",
            "risk_level": "moderate",
            "aggregate_risk_index": 58,
            "clauses": [
                {
                    "clause_type": "Payment Terms",
                    "category": "Financial",
                    "risk_level": "high",
                    "risk_score": 18,
                    "why_risky": "Payment date and cure period are vague.",
                }
            ],
            "contradictions_json": [],
        },
    ]

    result = await run_recommendation_agent(contracts, "user-1")

    assert result.team_name == "Recommendation Agent"
    assert result.status == "completed"
    recommendations = result.output["recommendations"]

    recurring = next(
        rec for rec in recommendations
        if "Payment Terms" in rec["action"] and rec["priority"] == "high"
    )
    assert recurring["related_contract_id"] == "contract-1"
    assert recurring["related_contract_name"] == "vendor-master.pdf"
    assert recurring["priority_label"] == "High Priority"
    assert recurring["suggested_due_date"]


@pytest.mark.asyncio
async def test_recommendation_agent_returns_empty_daily_advisor_state_without_history():
    result = await run_recommendation_agent([], "user-1")

    assert result.status == "completed"
    assert result.output["recommendations"] == []
    assert result.output["total"] == 0
    assert "Upload and analyze contracts" in result.output["reasoning_summary"]
