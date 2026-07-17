import pytest

from swarm.agents.daily_task import run_daily_task_agent


@pytest.mark.asyncio
async def test_daily_task_agent_prioritizes_critical_contract_work():
    contracts = [
        {
            "id": "contract-1",
            "filename": "vendor-agreement.pdf",
            "contract_type": "Vendor",
            "status": "complete",
            "risk_level": "high",
            "aggregate_risk_index": 88,
            "high_count": 4,
            "moderate_count": 2,
            "low_count": 1,
            "executive_summary": "Unlimited liability and weak payment terms.",
            "created_at": "2026-07-16T10:00:00Z",
            "clauses": [
                {"clause_type": "Payment Terms", "category": "Financial", "risk_level": "high"},
                {"clause_type": "Data Processing", "category": "Privacy", "risk_level": "high"},
            ],
            "contradictions_json": [{"severity": "high"}],
        },
        {
            "id": "contract-2",
            "filename": "nda.pdf",
            "contract_type": "NDA",
            "status": "processing",
            "risk_level": "unknown",
            "aggregate_risk_index": 0,
            "high_count": 0,
            "moderate_count": 0,
            "low_count": 0,
            "executive_summary": "",
            "created_at": "2026-07-17T10:00:00Z",
            "clauses": [],
            "contradictions_json": [],
        },
    ]
    recommendations = [
        {
            "id": "rec-1",
            "action": "Payment Clause Review",
            "reason": "Recurring high-risk financial clauses.",
            "priority": "high",
            "priority_label": "High Priority",
            "category": "Financial",
            "related_contract_id": "contract-1",
            "related_contract_name": "vendor-agreement.pdf",
            "suggested_due_date": "2026-07-22",
        }
    ]

    result = await run_daily_task_agent(contracts, recommendations, "user-1")

    assert result.team_name == "Daily Task Agent"
    assert result.status == "completed"
    assert result.output["chief_legal_officer_summary"]
    assert result.output["weekly_risk_score"] == 88
    assert result.output["priority_counts"]["Critical"] >= 1
    assert any(task["title"] == "Review Vendor Agreement" for task in result.output["todays_tasks"])
    assert any(task["title"] == "Payment Clause Review" for task in result.output["todays_tasks"])


@pytest.mark.asyncio
async def test_daily_task_agent_returns_empty_brief_without_contracts():
    result = await run_daily_task_agent([], [], "user-1")

    assert result.status == "completed"
    assert result.output["todays_tasks"] == []
    assert result.output["weekly_risk_score"] == 0
    assert "No contract work requires attention today" in result.output["chief_legal_officer_summary"]
