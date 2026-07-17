from datetime import datetime, timezone
from types import SimpleNamespace

from routers.daily_brief import contract_to_daily_brief_input


def test_contract_to_daily_brief_input_preserves_daily_brief_fields():
    contract = SimpleNamespace(
        id="contract-1",
        filename="employment.pdf",
        original_filename="Employment.pdf",
        contract_type="Employment",
        status="complete",
        risk_level="high",
        aggregate_risk_index=79,
        high_count=3,
        moderate_count=2,
        low_count=4,
        executive_summary="Non-compete is broad.",
        created_at=datetime(2026, 7, 17, tzinfo=timezone.utc),
        contradictions_json=[{"severity": "high"}],
        clauses=[
            SimpleNamespace(
                clause_type="Non-Compete",
                category="Employment",
                risk_level="high",
            )
        ],
    )

    data = contract_to_daily_brief_input(contract)

    assert data["id"] == "contract-1"
    assert data["contract_type"] == "Employment"
    assert data["high_count"] == 3
    assert data["clauses"][0]["clause_type"] == "Non-Compete"
    assert data["created_at"] == "2026-07-17T00:00:00+00:00"
