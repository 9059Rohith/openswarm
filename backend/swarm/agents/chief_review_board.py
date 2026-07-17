"""
Chief Review Board — intelligent consensus reviewer (deterministic cross-team rules).

Still calls existing groq_client for narrative executive summary and RAGEngine.generate_scenarios.
Risk/confidence adjustments come ONLY from swarm.review_rules (no vague LLM judging).
"""

from __future__ import annotations

from typing import Any

from services.groq_client import groq_client
from services.prompts import SUMMARY_SYSTEM
from services.rag_engine import RAGEngine
from swarm.review_rules import apply_cross_team_rules
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Chief Review Board"
SPECIALIZATION = (
    "Compares specialist findings, applies deterministic cross-team rules, "
    "and issues a consensus signing recommendation"
)


def _format_executive_summary(report: dict[str, Any], narrative: str) -> str:
    """Compose API-compatible executive_summary text including consensus sections."""
    critical = report.get("critical_issues") or []
    evidence = report.get("supporting_evidence") or []
    contributions = report.get("team_contributions") or []
    lines = [
        narrative.strip(),
        "",
        "—— Chief Review Board Consensus ——",
        f"Overall Risk: {str(report.get('overall_risk', '')).upper()} "
        f"(CRI {report.get('overall_cri', 0):.0f}/100)",
        f"Contract Recommendation: {report.get('contract_recommendation')}",
        f"Signing Recommendation: {report.get('signing_recommendation')}",
        f"Board Confidence: {float(report.get('confidence', 0)):.0%}",
        "",
        "Critical Issues:",
    ]
    if critical:
        lines.extend(f"• {item}" for item in critical[:8])
    else:
        lines.append("• None identified by cross-team rules.")
    lines.append("")
    lines.append("Supporting Evidence:")
    if evidence:
        lines.extend(f"• {item}" for item in evidence[:8])
    else:
        lines.append("• No cross-team corroboration recorded.")
    lines.append("")
    lines.append("Team Contributions:")
    for t in contributions:
        lines.append(
            f"• {t.get('team')}: {t.get('finding_count', 0)} finding(s), "
            f"confidence={t.get('confidence')}; {t.get('summary')}"
        )
    lines.append("")
    lines.append(f"Reasoning Summary: {report.get('reasoning_summary')}")
    if report.get("what_changed"):
        lines.append("")
        lines.append("What Changed vs Specialist Findings:")
        lines.extend(f"• {w}" for w in report["what_changed"][:8])
    return "\n".join(lines)


async def run_chief_review_board(context: dict[str, Any]) -> AgentResult:
    async def work():
        scored_clauses = context.get("scored_clauses") or []
        contract_type = context.get("contract_type") or ""
        counterparty = context.get("counterparty") or ""
        jurisdiction = context.get("jurisdiction") or ""
        cri = float(context.get("cri") or 0)
        risk_level = context.get("risk_level") or "moderate"
        high_count = int(context.get("high_count") or 0)
        moderate_count = int(context.get("moderate_count") or 0)
        low_count = int(context.get("low_count") or 0)

        financial = context.get("financial_output") or {}
        privacy = context.get("privacy_output") or {}
        litigation = context.get("litigation_output") or {}

        # ── Deterministic collaboration (no LLM) ────────────────────────────
        consensus = apply_cross_team_rules(
            scored_clauses=scored_clauses,
            base_cri=cri,
            base_risk_level=risk_level,
            financial=financial,
            privacy=privacy,
            litigation=litigation,
            specialist_confidences={
                "Financial Risk Team": float(
                    financial.get("confidence")
                    or context.get("financial_confidence")
                    or 0.7
                ),
                "Privacy / Compliance Team": float(
                    privacy.get("confidence")
                    or context.get("privacy_confidence")
                    or 0.7
                ),
                "Litigation Prediction Team": float(
                    litigation.get("confidence")
                    or context.get("litigation_confidence")
                    or 0.7
                ),
            },
        )

        effective_clauses = consensus["scored_clauses"]
        effective_cri = consensus["effective_cri"]
        effective_risk = consensus["effective_risk_level"]
        contradictions = litigation.get("contradictions") or []

        # Existing scenario generator on (possibly risk-bumped) clause set.
        scenarios = RAGEngine.generate_scenarios(effective_clauses)

        contradiction_summary = ""
        if contradictions:
            contradiction_summary = f"\nLogical Contradictions Detected: {len(contradictions)}\n"
            for c in contradictions[:3]:
                contradiction_summary += (
                    f"- [{c['category']}] {c['description'][:100]}...\n"
                )

        legal_review_count = sum(
            1 for c in effective_clauses if c.get("requires_legal_review")
        )

        # Feed board consensus into Groq narrative context (facts only; rules already applied).
        summary_context = (
            f"Contract Type: {contract_type}\n"
            f"Counterparty: {counterparty or 'Unknown'}\n"
            f"Governing Law: {jurisdiction or 'Not specified'}\n"
            f"Overall Risk Level: {effective_risk.upper()} "
            f"(CRI: {effective_cri:.0f}/100; base CRI was {cri:.0f})\n"
            f"Signing Recommendation: {consensus['signing_recommendation']}\n"
            f"High Risk Clauses: {consensus['high_count']}\n"
            f"Moderate Risk Clauses: {consensus['moderate_count']}\n"
            f"Low Risk Clauses: {consensus['low_count']}\n"
            f"Clauses Requiring Legal Review: {legal_review_count}\n"
            f"Cross-team rules fired: {', '.join(consensus['rules_fired']) or 'none'}\n"
            f"{contradiction_summary}\n"
            f"What changed in review:\n"
            + "\n".join(f"- {w}" for w in (consensus["what_changed"] or ["None"])[:5])
            + "\nTop Issues:\n"
            + "\n".join(
                f"- {c.get('clause_type')}: {c.get('why_risky', '')}"
                for c in effective_clauses[:5]
            )
        )

        narrative = await groq_client.complete(
            SUMMARY_SYSTEM,
            summary_context,
            temperature=0.3,
            max_tokens=350,
        )
        if not narrative or len(narrative.strip()) < 20:
            narrative = (
                f"This {contract_type} contract carries a {effective_risk.upper()} overall risk "
                f"(CRI: {effective_cri:.0f}/100) with {consensus['high_count']} high-risk clauses. "
                f"{consensus['signing_recommendation']}"
            )

        final_report = {
            "overall_risk": effective_risk,
            "overall_cri": effective_cri,
            "contract_recommendation": consensus["contract_recommendation"],
            "signing_recommendation": consensus["signing_recommendation"],
            "critical_issues": consensus["critical_issues"],
            "supporting_evidence": consensus["supporting_evidence"],
            "confidence": consensus["board_confidence"],
            "team_contributions": consensus["team_contributions"],
            "reasoning_summary": consensus["reasoning_summary"],
            "what_changed": consensus["what_changed"],
            "conflicts": consensus["conflicts"],
            "rules_fired": consensus["rules_fired"],
        }

        executive_summary = _format_executive_summary(final_report, narrative)

        output = {
            "executive_summary": executive_summary,
            "scenarios": scenarios,
            "final_report": final_report,
            "signing_recommendation": consensus["signing_recommendation"],
            "effective_cri": effective_cri,
            "effective_risk_level": effective_risk,
            "scored_clauses": effective_clauses,
            "high_count": consensus["high_count"],
            "moderate_count": consensus["moderate_count"],
            "low_count": consensus["low_count"],
            "specialist_briefs": {
                "financial": {
                    "findings": financial.get("findings"),
                    "confidence": financial.get("confidence"),
                },
                "privacy_compliance": {
                    "findings": privacy.get("findings"),
                    "confidence": privacy.get("confidence"),
                },
                "litigation": {
                    "findings": litigation.get("findings"),
                    "confidence": litigation.get("confidence"),
                    "contradiction_count": litigation.get("contradiction_count", 0),
                },
            },
        }
        reasoning = consensus["reasoning_summary"]
        return output, reasoning, consensus["board_confidence"]

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=[
            "Financial Risk Team",
            "Privacy / Compliance Team",
            "Litigation Prediction Team",
        ],
        work=work,
    )
