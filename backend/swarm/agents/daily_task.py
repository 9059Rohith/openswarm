"""
Daily Task Agent - builds a daily legal brief from the user's contract portfolio.

This agent is a productivity layer. It does not participate in the per-contract
analysis flow and does not call paid APIs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Daily Task Agent"
SPECIALIZATION = "Collects portfolio signals, prioritizes daily legal tasks, and produces a concise legal briefing"

PRIORITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


async def run_daily_task_agent(
    contracts_data: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
    user_id: str,
) -> AgentResult:
    async def work():
        now = datetime.now(timezone.utc)
        today = now.date()
        completed = [c for c in contracts_data if c.get("status") == "complete"]
        pending = [c for c in contracts_data if c.get("status") in {"pending", "processing"}]
        high_risk = [c for c in completed if c.get("risk_level") == "high"]
        tasks: list[dict[str, Any]] = []

        for contract in high_risk:
            priority = "Critical" if _risk_score(contract) >= 80 or contract.get("high_count", 0) >= 3 else "High"
            tasks.append(_task(
                title=f"Review {_readable_contract_type(contract)}",
                priority=priority,
                due_label="Today" if priority == "Critical" else "Due Tomorrow",
                category="Pending Contract Reviews",
                reason=_contract_reason(contract),
                related_contract_id=contract.get("id"),
                related_contract_name=contract.get("filename"),
                due_date=(today if priority == "Critical" else today + timedelta(days=1)).isoformat(),
            ))

        for contract in pending:
            tasks.append(_task(
                title=f"Complete analysis for {_readable_contract_type(contract)}",
                priority="Medium",
                due_label="In Progress",
                category="Pending Contract Reviews",
                reason="This contract is not ready for legal decisioning until analysis completes.",
                related_contract_id=contract.get("id"),
                related_contract_name=contract.get("filename"),
                due_date=today.isoformat(),
            ))

        for recommendation in recommendations:
            priority = _recommendation_priority(recommendation)
            tasks.append(_task(
                title=recommendation.get("action") or "Recommended Action",
                priority=priority,
                due_label=_due_label(recommendation.get("suggested_due_date"), today),
                category=recommendation.get("category") or "Recommended Actions",
                reason=recommendation.get("reason") or "Recommended by the AI Legal Organization.",
                related_contract_id=recommendation.get("related_contract_id"),
                related_contract_name=recommendation.get("related_contract_name"),
                due_date=recommendation.get("suggested_due_date") or today.isoformat(),
            ))

        privacy_alerts = _privacy_alerts(completed)
        compliance_alerts = _compliance_alerts(completed, recommendations)
        for alert in privacy_alerts + compliance_alerts:
            tasks.append(alert)

        tasks = _dedupe_tasks(tasks)
        tasks.sort(key=lambda t: (PRIORITY_ORDER.get(t["priority"], 4), t.get("due_date") or "9999-12-31"))

        weekly_risk_score = round(max((_risk_score(c) for c in completed), default=0))
        risk_trend = _risk_trend(completed)
        priority_counts = {label: sum(1 for task in tasks if task["priority"] == label) for label in PRIORITY_ORDER}
        summary = _chief_legal_officer_summary(tasks, high_risk, pending, recommendations)

        output = {
            "agent_name": TEAM_NAME,
            "brief_date": today.isoformat(),
            "chief_legal_officer_summary": summary,
            "todays_tasks": tasks[:12],
            "todays_legal_priorities": tasks[:5],
            "pending_contract_reviews": _contract_cards(high_risk + pending),
            "high_risk_contracts": _contract_cards(high_risk),
            "upcoming_deadlines": [t for t in tasks if t.get("due_label") in {"Today", "Due Tomorrow", "This Week"}],
            "pending_signatures": _pending_signatures(completed),
            "compliance_alerts": compliance_alerts,
            "privacy_alerts": privacy_alerts,
            "contract_expiry_alerts": [],
            "recommended_actions": recommendations[:8],
            "new_legal_recommendations": recommendations[:5],
            "risk_trend": risk_trend,
            "weekly_risk_score": weekly_risk_score,
            "recent_activities": _recent_activities(contracts_data),
            "priority_counts": priority_counts,
        }
        reasoning = (
            f"Reviewed {len(contracts_data)} contract(s), {len(recommendations)} recommendation(s), "
            f"and generated {len(tasks)} daily task(s)."
        )
        confidence = 0.86 if contracts_data or recommendations else 0.7
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Recommendation Agent"],
        work=work,
    )


def _task(
    *,
    title: str,
    priority: str,
    due_label: str,
    category: str,
    reason: str,
    related_contract_id: str | None,
    related_contract_name: str | None,
    due_date: str,
) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "priority": priority,
        "due_label": due_label,
        "category": category,
        "reason": reason,
        "related_contract_id": related_contract_id,
        "related_contract_name": related_contract_name,
        "due_date": due_date,
    }


def _risk_score(contract: dict[str, Any]) -> float:
    return float(contract.get("aggregate_risk_index") or 0)


def _readable_contract_type(contract: dict[str, Any]) -> str:
    contract_type = contract.get("contract_type") or "Contract"
    if contract_type == "Unknown":
        contract_type = "Contract"
    return f"{contract_type} Agreement" if "agreement" not in contract_type.lower() else contract_type


def _contract_reason(contract: dict[str, Any]) -> str:
    high_count = int(contract.get("high_count") or 0)
    score = _risk_score(contract)
    summary = contract.get("executive_summary") or "High risk signals require attention."
    return f"Risk score {score:.0f}/100 with {high_count} high-risk clause(s). {summary}"


def _recommendation_priority(recommendation: dict[str, Any]) -> str:
    priority = recommendation.get("priority")
    if priority == "high":
        return "High"
    if priority == "medium":
        return "Medium"
    return "Low"


def _due_label(date_str: str | None, today) -> str:
    if not date_str:
        return "This Week"
    try:
        due_date = datetime.fromisoformat(date_str).date()
    except ValueError:
        return "This Week"
    delta = (due_date - today).days
    if delta <= 0:
        return "Today"
    if delta == 1:
        return "Due Tomorrow"
    if delta <= 7:
        return "This Week"
    return "Upcoming"


def _privacy_alerts(contracts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    alerts = []
    for contract in contracts:
        has_privacy_risk = any(
            (clause.get("category") or "").lower() in {"privacy", "compliance"}
            and clause.get("risk_level") == "high"
            for clause in contract.get("clauses", [])
        )
        if has_privacy_risk:
            alerts.append(_task(
                title="Privacy Alert",
                priority="High",
                due_label="Today",
                category="Privacy Alerts",
                reason="High-risk privacy or compliance clauses require review.",
                related_contract_id=contract.get("id"),
                related_contract_name=contract.get("filename"),
                due_date=datetime.now(timezone.utc).date().isoformat(),
            ))
    return alerts


def _compliance_alerts(
    contracts: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    alerts = []
    has_gdpr_recommendation = any("gdpr" in (r.get("action") or "").lower() for r in recommendations)
    if has_gdpr_recommendation:
        alerts.append(_task(
            title="GDPR Update Needed",
            priority="Medium",
            due_label="This Week",
            category="Compliance Alerts",
            reason="Recommendation Agent found missing or weak GDPR/data protection language.",
            related_contract_id=None,
            related_contract_name=None,
            due_date=(datetime.now(timezone.utc).date() + timedelta(days=7)).isoformat(),
        ))
    for contract in contracts:
        if contract.get("contradictions_json"):
            alerts.append(_task(
                title="Resolve Contract Conflicts",
                priority="High",
                due_label="Today",
                category="Compliance Alerts",
                reason="Internal contradictions can weaken enforceability and require review.",
                related_contract_id=contract.get("id"),
                related_contract_name=contract.get("filename"),
                due_date=datetime.now(timezone.utc).date().isoformat(),
            ))
    return alerts


def _contract_cards(contracts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": c.get("id"),
            "title": c.get("filename"),
            "contract_type": c.get("contract_type"),
            "risk_level": c.get("risk_level"),
            "risk_score": _risk_score(c),
            "status": c.get("status"),
        }
        for c in contracts
    ]


def _pending_signatures(contracts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": c.get("id"),
            "title": c.get("filename"),
            "risk_level": c.get("risk_level"),
            "recommendation": "Review before signing",
        }
        for c in contracts
        if c.get("risk_level") in {"low", "moderate"}
    ][:5]


def _risk_trend(contracts: list[dict[str, Any]]) -> str:
    scores = [_risk_score(c) for c in contracts if c.get("status") == "complete"]
    if not scores:
        return "No analyzed contracts yet"
    if max(scores) >= 75:
        return "Elevated"
    if sum(scores) / len(scores) >= 45:
        return "Watch"
    return "Stable"


def _recent_activities(contracts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    activities = []
    for contract in contracts[:6]:
        activities.append({
            "id": contract.get("id"),
            "label": f"{contract.get('filename')} analyzed" if contract.get("status") == "complete" else f"{contract.get('filename')} {contract.get('status')}",
            "contract_type": contract.get("contract_type"),
            "created_at": contract.get("created_at"),
        })
    return activities


def _dedupe_tasks(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str | None]] = set()
    deduped = []
    for task in tasks:
        key = (task["title"], task.get("related_contract_id"))
        if key not in seen:
            seen.add(key)
            deduped.append(task)
    return deduped


def _chief_legal_officer_summary(
    tasks: list[dict[str, Any]],
    high_risk: list[dict[str, Any]],
    pending: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
) -> str:
    if not tasks:
        return "No contract work requires attention today. Monitor new uploads and keep templates current."
    critical = sum(1 for task in tasks if task["priority"] == "Critical")
    high = sum(1 for task in tasks if task["priority"] == "High")
    return (
        f"What requires your attention today: {critical} critical and {high} high-priority legal task(s), "
        f"{len(high_risk)} high-risk contract(s), {len(pending)} pending review(s), "
        f"and {len(recommendations)} recommendation(s) from the AI Legal Organization."
    )
