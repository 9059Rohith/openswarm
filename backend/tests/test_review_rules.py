"""Unit tests for deterministic Chief Review Board rules (no LLM)."""

from swarm.review_rules import apply_cross_team_rules


def test_litigation_x_financial_high_bumps_cri():
    scored = [
        {
            "clause_type": "Limitation of Liability",
            "category": "Financial",
            "risk_level": "high",
            "risk_score": 20,
            "risk_score_adjusted": 6.0,
            "why_risky": "Broad liability",
            "raw_text": "unlimited liability notwithstanding any limitation",
        },
        {
            "clause_type": "Liability Cap",
            "category": "Financial",
            "risk_level": "moderate",
            "risk_score": 12,
            "risk_score_adjusted": 4.0,
            "why_risky": "Cap present",
            "raw_text": "liability shall not exceed fees paid",
        },
    ]
    financial = {
        "findings": [
            {
                "clause_type": "Limitation of Liability",
                "severity": "high",
                "risk_level": "high",
                "summary": "Broad liability",
            }
        ],
        "evidence": [
            {"clause_type": "Limitation of Liability", "detail": "unlimited", "risk_level": "high"}
        ],
        "financial_risk_level": "high",
        "confidence": 0.8,
        "reasoning_summary": "Financial high",
        "top_exposures": [
            {"clause_type": "Limitation of Liability", "risk_level": "high", "risk_score": 20}
        ],
    }
    privacy = {"findings": [], "evidence": [], "confidence": 0.6, "reasoning_summary": "none"}
    litigation = {
        "findings": [
            {
                "clause_type": "Limitation of Liability",
                "related_types": ["Limitation of Liability", "Liability Cap"],
                "severity": "high",
                "summary": "Cap contradiction",
            }
        ],
        "contradictions": [
            {
                "clause_a": "Limitation of Liability",
                "clause_b": "Liability Cap",
                "category": "Liability Cap Contradiction",
                "description": "Unlimited vs capped liability",
                "severity": "high",
            }
        ],
        "confidence": 0.85,
        "reasoning_summary": "1 contradiction",
    }

    result = apply_cross_team_rules(
        scored_clauses=scored,
        base_cri=55.0,
        base_risk_level="moderate",
        financial=financial,
        privacy=privacy,
        litigation=litigation,
        specialist_confidences={
            "Financial Risk Team": 0.8,
            "Privacy / Compliance Team": 0.6,
            "Litigation Prediction Team": 0.85,
        },
    )
    assert "R1_litigation_x_financial_high_bump" in result["rules_fired"]
    assert result["effective_cri"] >= 55.0 + 8.0 - 0.01
    assert "DO NOT SIGN" in result["signing_recommendation"] or result["effective_risk_level"] in {
        "moderate",
        "high",
    }
    assert result["what_changed"]


def test_privacy_gdpr_x_financial_medium_note():
    scored = [
        {
            "clause_type": "Data Protection",
            "category": "Privacy",
            "risk_level": "moderate",
            "risk_score": 12,
            "risk_score_adjusted": 4.0,
            "why_risky": "GDPR personal data processing without DPA",
            "raw_text": "GDPR personal data",
        }
    ]
    financial = {
        "findings": [
            {
                "clause_type": "Payment Terms",
                "severity": "moderate",
                "risk_level": "moderate",
                "summary": "Fees",
            }
        ],
        "evidence": [],
        "financial_risk_level": "moderate",
        "confidence": 0.7,
        "reasoning_summary": "medium financial",
        "top_exposures": [],
    }
    privacy = {
        "findings": [
            {
                "clause_type": "Data Protection",
                "severity": "moderate",
                "summary": "GDPR personal data processing gap",
            }
        ],
        "evidence": [
            {"clause_type": "Data Protection", "detail": "GDPR personal data", "risk_level": "moderate"}
        ],
        "top_issues": [
            {"clause_type": "Data Protection", "why_risky": "GDPR", "category": "Privacy"}
        ],
        "confidence": 0.72,
        "reasoning_summary": "privacy hit",
    }
    litigation = {
        "findings": [],
        "contradictions": [],
        "confidence": 0.5,
        "reasoning_summary": "none",
    }

    result = apply_cross_team_rules(
        scored_clauses=scored,
        base_cri=40.0,
        base_risk_level="moderate",
        financial=financial,
        privacy=privacy,
        litigation=litigation,
        specialist_confidences={
            "Financial Risk Team": 0.7,
            "Privacy / Compliance Team": 0.72,
            "Litigation Prediction Team": 0.5,
        },
    )
    assert "R2_privacy_gdpr_x_financial_medium" in result["rules_fired"]
    assert any("Privacy compliance increases the legal exposure" in x for x in result["critical_issues"])
    assert result["effective_cri"] >= 44.0 - 0.01


def test_multi_team_corroboration_raises_confidence():
    scored = [
        {
            "clause_type": "Confidentiality",
            "category": "Privacy",
            "risk_level": "high",
            "risk_score": 16,
            "risk_score_adjusted": 5.5,
            "why_risky": "Perpetual",
            "raw_text": "confidential indefinitely",
        }
    ]
    financial = {
        "findings": [
            {"clause_type": "Confidentiality", "severity": "high", "risk_level": "high", "summary": "x"}
        ],
        "evidence": [{"clause_type": "Confidentiality", "detail": "x", "risk_level": "high"}],
        "financial_risk_level": "high",
        "confidence": 0.7,
        "reasoning_summary": "fin",
    }
    privacy = {
        "findings": [
            {"clause_type": "Confidentiality", "severity": "high", "risk_level": "high", "summary": "y"}
        ],
        "evidence": [{"clause_type": "Confidentiality", "detail": "y", "risk_level": "high"}],
        "confidence": 0.7,
        "reasoning_summary": "priv",
    }
    litigation = {
        "findings": [],
        "contradictions": [],
        "confidence": 0.7,
        "reasoning_summary": "none",
    }
    result = apply_cross_team_rules(
        scored_clauses=scored,
        base_cri=50.0,
        base_risk_level="moderate",
        financial=financial,
        privacy=privacy,
        litigation=litigation,
        specialist_confidences={
            "Financial Risk Team": 0.7,
            "Privacy / Compliance Team": 0.7,
            "Litigation Prediction Team": 0.7,
        },
    )
    assert "R3_multi_team_corroboration_confidence_up" in result["rules_fired"]
    assert result["board_confidence"] > 0.7
