from types import SimpleNamespace

from routers.recommendations import contract_to_recommendation_input


def test_contract_to_recommendation_input_includes_clause_history():
    contract = SimpleNamespace(
        id="contract-1",
        filename="nda.pdf",
        original_filename="NDA.pdf",
        contract_type="NDA",
        risk_level="high",
        aggregate_risk_index=76,
        contradictions_json=[{"description": "Term conflict"}],
        clauses=[
            SimpleNamespace(
                id="clause-1",
                clause_type="GDPR",
                category="Privacy",
                risk_level="high",
                risk_score=19,
                why_risky="Missing DPA language.",
            )
        ],
    )

    data = contract_to_recommendation_input(contract)

    assert data["id"] == "contract-1"
    assert data["filename"] == "nda.pdf"
    assert data["contract_type"] == "NDA"
    assert data["clauses"][0]["clause_type"] == "GDPR"
    assert data["contradictions_json"] == [{"description": "Term conflict"}]
