"""
Recommendation Agent — analyzes user contract history to generate personalized
legal recommendations.

This agent does NOT participate in the per-contract analysis pipeline.
It runs independently when the user requests recommendations via the API.

Output package: list of prioritized recommendations with action, reason,
related contract, and suggested due date.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Recommendation Agent"
SPECIALIZATION = "Analyzes contract history and generates personalized legal recommendations"


# ── Clause type to recommendation mapping ────────────────────────────────────

_MISSING_CLAUSE_CHECKS = {
    "Arbitration": {
        "action": "Add arbitration clause to contracts",
        "reason": "No arbitration clause detected — disputes default to costly litigation.",
        "category": "Dispute Resolution",
    },
    "GDPR": {
        "action": "Add missing GDPR / data protection clauses",
        "reason": "Contracts lack GDPR compliance language, exposing you to regulatory fines.",
        "category": "Privacy & Compliance",
    },
    "Non-Compete": {
        "action": "Review non-compete clause scope",
        "reason": "Overly broad non-compete clauses may be unenforceable and limit your options.",
        "category": "Employment",
    },
    "Indemnification": {
        "action": "Review indemnification obligations",
        "reason": "Unbalanced indemnification shifts disproportionate risk to one party.",
        "category": "Financial",
    },
    "Data Breach Notification": {
        "action": "Add data breach notification requirements",
        "reason": "Missing breach notification timelines create regulatory exposure.",
        "category": "Privacy & Compliance",
    },
    "Insurance": {
        "action": "Consider adding cyber insurance requirements",
        "reason": "No insurance clauses found — consider requiring proof of coverage.",
        "category": "Risk Management",
    },
    "Payment Terms": {
        "action": "Strengthen payment terms and penalties",
        "reason": "Weak or missing payment terms increase financial exposure.",
        "category": "Financial",
    },
}

# Contract types that should trigger review recommendations
_CONTRACT_REVIEW_TEMPLATES = {
    "NDA": "Review NDA template for completeness",
    "Employment": "Update employment contract template",
    "Vendor": "Improve vendor agreement wording",
    "Subscription": "Review subscription terms and auto-renewal",
    "Freelance": "Update freelance agreement IP provisions",
    "Rental": "Review rental/lease agreement protections",
    "Privacy Policy": "Review privacy policy for regulatory updates",
}


async def run_recommendation_agent(
    contracts_data: list[dict[str, Any]],
    user_id: str,
    user_profile: dict[str, Any] | None = None,
    company_profile: dict[str, Any] | None = None,
) -> AgentResult:
    """
    Analyze all completed contracts for a user and generate recommendations.

    Parameters
    ----------
    contracts_data : list[dict]
        Each dict contains: id, filename, contract_type, risk_level,
        aggregate_risk_index, clauses (list of clause dicts with clause_type,
        risk_level, risk_score, category, why_risky).
    user_id : str
        The user's ID (for context only).
    user_profile : dict | None
        Optional user/account context.
    company_profile : dict | None
        Optional company context when available.
    """

    async def work():
        recommendations: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        if not contracts_data:
            return {
                "recommendations": [],
                "total": 0,
                "reasoning_summary": "No completed contracts found. Upload and analyze contracts to receive recommendations.",
            }, "No contracts available for recommendation analysis.", 1.0

        # ── 1. Detect high-risk contracts needing review ─────────────────
        high_risk_contracts = [
            c for c in contracts_data if c.get("risk_level") == "high"
        ]
        for c in high_risk_contracts:
            recommendations.append({
                "id": str(uuid.uuid4()),
                "action": f"Schedule urgent legal review for '{c.get('filename', 'Unknown')}'",
                "reason": f"Contract scored {c.get('aggregate_risk_index', 0):.0f}/100 risk — classified as HIGH risk. Immediate legal counsel recommended.",
                "priority": "high",
                "category": "Legal Review",
                "related_contract_id": c.get("id"),
                "related_contract_name": c.get("filename"),
                "suggested_due_date": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
            })

        # ── 2. Detect recurring high-risk clause types ───────────────────
        clause_type_risk_counts: dict[str, int] = {}
        clause_type_contracts: dict[str, list[dict[str, Any]]] = {}
        all_clause_types_seen: set[str] = set()

        for c in contracts_data:
            for clause in c.get("clauses", []):
                ct = clause.get("clause_type", "Unknown")
                all_clause_types_seen.add(ct)
                if clause.get("risk_level") == "high":
                    clause_type_risk_counts[ct] = clause_type_risk_counts.get(ct, 0) + 1
                    if ct not in clause_type_contracts:
                        clause_type_contracts[ct] = []
                    cid = c.get("id")
                    if cid and not any(item.get("id") == cid for item in clause_type_contracts[ct]):
                        clause_type_contracts[ct].append({
                            "id": cid,
                            "name": c.get("filename") or c.get("original_filename"),
                        })

        for ct, count in sorted(clause_type_risk_counts.items(), key=lambda x: -x[1]):
            if count >= 2:
                related = clause_type_contracts.get(ct, [])
                first_related = related[0] if related else {}
                recommendations.append({
                    "id": str(uuid.uuid4()),
                    "action": f"Address recurring '{ct}' risk across contracts",
                    "reason": f"'{ct}' flagged as HIGH risk in {count} contracts. This pattern suggests a systemic template issue.",
                    "priority": "high",
                    "category": "Recurring Risk",
                    "related_contract_id": first_related.get("id"),
                    "related_contract_name": first_related.get("name"),
                    "suggested_due_date": (now + timedelta(days=7)).strftime("%Y-%m-%d"),
                })

        # ── 3. Detect missing important clause types ─────────────────────
        for expected_type, rec_info in _MISSING_CLAUSE_CHECKS.items():
            # Check if any contract mentions this clause type
            found = any(
                expected_type.lower() in ct.lower() for ct in all_clause_types_seen
            )
            if not found and len(contracts_data) >= 1:
                recommendations.append({
                    "id": str(uuid.uuid4()),
                    "action": rec_info["action"],
                    "reason": rec_info["reason"],
                    "priority": "medium",
                    "category": rec_info["category"],
                    "related_contract_id": None,
                    "related_contract_name": None,
                    "suggested_due_date": (now + timedelta(days=14)).strftime("%Y-%m-%d"),
                })

        # ── 4. Contract type-specific template review suggestions ────────
        seen_types: set[str] = set()
        for c in contracts_data:
            ct = c.get("contract_type", "")
            if ct and ct != "Unknown" and ct not in seen_types:
                seen_types.add(ct)
                matched_type = _match_contract_type(ct)
                if matched_type:
                    avg_risk = c.get("aggregate_risk_index", 0)
                    priority = "medium" if avg_risk > 40 else "low"
                    recommendations.append({
                        "id": str(uuid.uuid4()),
                        "action": _CONTRACT_REVIEW_TEMPLATES[matched_type],
                        "reason": f"You have analyzed {ct} contracts. Periodic template review ensures compliance with current regulations.",
                        "priority": priority,
                        "category": "Template Review",
                        "related_contract_id": c.get("id"),
                        "related_contract_name": c.get("filename"),
                        "suggested_due_date": (now + timedelta(days=30)).strftime("%Y-%m-%d"),
                    })

        # ── 5. High financial exposure detection ─────────────────────────
        financial_high_count = sum(
            1
            for c in contracts_data
            for cl in c.get("clauses", [])
            if (cl.get("category") or "").lower() == "financial"
            and cl.get("risk_level") == "high"
        )
        if financial_high_count >= 2:
            recommendations.append({
                "id": str(uuid.uuid4()),
                "action": "High financial exposure detected repeatedly",
                "reason": f"{financial_high_count} high-risk financial clauses found across your contracts. Consider legal review and stronger payment, liability, and insurance protections.",
                "priority": "high",
                "category": "Financial",
                "related_contract_id": None,
                "related_contract_name": None,
                "suggested_due_date": (now + timedelta(days=5)).strftime("%Y-%m-%d"),
            })

        # ── 6. Contradiction-heavy contracts ─────────────────────────────
        for c in contracts_data:
            contradictions = c.get("contradictions_json") or []
            if len(contradictions) >= 3:
                recommendations.append({
                    "id": str(uuid.uuid4()),
                    "action": f"Resolve contradictions in '{c.get('filename', 'Unknown')}'",
                    "reason": f"{len(contradictions)} internal contradictions detected. Contradictory clauses can void protections.",
                    "priority": "high",
                    "category": "Contract Quality",
                    "related_contract_id": c.get("id"),
                    "related_contract_name": c.get("filename"),
                    "suggested_due_date": (now + timedelta(days=5)).strftime("%Y-%m-%d"),
                })

        # ── 7. General periodic review recommendation ────────────────────
        if len(contracts_data) >= 3:
            recommendations.append({
                "id": str(uuid.uuid4()),
                "action": "Schedule quarterly legal portfolio review",
                "reason": f"You have {len(contracts_data)} analyzed contracts. Regular portfolio reviews help catch emerging risks.",
                "priority": "low",
                "category": "Best Practice",
                "related_contract_id": None,
                "related_contract_name": None,
                "suggested_due_date": (now + timedelta(days=90)).strftime("%Y-%m-%d"),
            })

        # ── Sort by priority ─────────────────────────────────────────────
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda r: priority_order.get(r["priority"], 3))

        # ── Deduplicate by action text ───────────────────────────────────
        seen_actions: set[str] = set()
        deduped: list[dict] = []
        for r in recommendations:
            if r["action"] not in seen_actions:
                seen_actions.add(r["action"])
                r["priority_label"] = _priority_label(r.get("priority"))
                deduped.append(r)
        recommendations = deduped

        high_count = sum(1 for r in recommendations if r["priority"] == "high")
        med_count = sum(1 for r in recommendations if r["priority"] == "medium")
        low_count = sum(1 for r in recommendations if r["priority"] == "low")

        reasoning = (
            f"Analyzed {len(contracts_data)} contract(s) with their clauses. "
            f"Generated {len(recommendations)} recommendation(s): "
            f"{high_count} high, {med_count} medium, {low_count} low priority."
        )
        confidence = 0.85 if contracts_data else 0.5

        output = {
            "recommendations": recommendations,
            "categories": _group_by_priority(recommendations),
            "total": len(recommendations),
            "high_count": high_count,
            "medium_count": med_count,
            "low_count": low_count,
            "agent_name": TEAM_NAME,
            "user_context": {
                "user_id": user_id,
                "has_user_profile": bool(user_profile),
                "has_company_profile": bool(company_profile),
            },
        }
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=[],
        work=work,
    )


def _priority_label(priority: str | None) -> str:
    if priority == "high":
        return "High Priority"
    if priority == "medium":
        return "Medium Priority"
    if priority == "low":
        return "Low Priority"
    return "Priority"


def _match_contract_type(contract_type: str) -> str | None:
    normalized = contract_type.lower()
    for known in _CONTRACT_REVIEW_TEMPLATES:
        if known.lower() in normalized:
            return known
    return None


def _group_by_priority(recommendations: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    groups = {
        "High Priority": [],
        "Medium Priority": [],
        "Low Priority": [],
    }
    for recommendation in recommendations:
        label = recommendation.get("priority_label") or _priority_label(
            recommendation.get("priority")
        )
        if label in groups:
            groups[label].append(recommendation)
    return groups
