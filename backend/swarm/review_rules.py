"""
Deterministic Chief Review Board rules.

No LLM reasoning here — every confidence/risk adjustment is an explicit IF/THEN.
Specialist teams still call unchanged LexGuard services; this module only compares outputs.
"""

from __future__ import annotations

from typing import Any


def _norm(text: str) -> str:
    return " ".join((text or "").lower().split())


def _clause_key(clause: dict[str, Any]) -> str:
    return _norm(str(clause.get("clause_type") or clause.get("id") or ""))


def _finding_keys(findings: list[dict[str, Any]]) -> set[str]:
    keys: set[str] = set()
    for f in findings:
        k = _norm(str(f.get("clause_type") or f.get("id") or ""))
        if k:
            keys.add(k)
        # Also index evidence labels
        for e in f.get("related_types") or []:
            ek = _norm(str(e))
            if ek:
                keys.add(ek)
    return keys


def _matches(a: str, b: str) -> bool:
    if not a or not b:
        return False
    return a == b or a in b or b in a


def _financial_risk_band(financial: dict[str, Any]) -> str:
    return str(financial.get("financial_risk_level") or "low").lower()


def _is_gdpr_or_privacy_exposure(privacy: dict[str, Any]) -> bool:
    """True when Privacy team surfaced GDPR / data-protection style issues."""
    needles = ("gdpr", "personal data", "data protection", "data privacy", "privacy")
    blobs: list[str] = []
    for f in privacy.get("findings") or []:
        blobs.append(str(f.get("summary") or ""))
        blobs.append(str(f.get("clause_type") or ""))
    for e in privacy.get("evidence") or []:
        blobs.append(str(e.get("detail") or ""))
        blobs.append(str(e.get("clause_type") or ""))
    for issue in privacy.get("top_issues") or []:
        blobs.append(str(issue.get("clause_type") or ""))
        blobs.append(str(issue.get("why_risky") or ""))
        blobs.append(str(issue.get("category") or ""))
    hay = " ".join(blobs).lower()
    return any(n in hay for n in needles) and bool(privacy.get("findings") or privacy.get("top_issues"))


def apply_cross_team_rules(
    *,
    scored_clauses: list[dict[str, Any]],
    base_cri: float,
    base_risk_level: str,
    financial: dict[str, Any],
    privacy: dict[str, Any],
    litigation: dict[str, Any],
    specialist_confidences: dict[str, float],
) -> dict[str, Any]:
    """
    Compare specialist outputs and return a consensus package.

    Returns keys used by Chief Review Board final_report.
    """
    clauses = [dict(c) for c in scored_clauses]  # shallow copy — do not mutate caller mid-flight
    effective_cri = float(base_cri)
    what_changed: list[str] = []
    conflicts: list[str] = []
    supporting: list[str] = []
    critical_issues: list[str] = []
    rules_fired: list[str] = []

    fin_findings = list(financial.get("findings") or [])
    priv_findings = list(privacy.get("findings") or [])
    lit_findings = list(litigation.get("findings") or [])
    contradictions = list(litigation.get("contradictions") or [])

    fin_high_types = {
        _norm(str(f.get("clause_type") or ""))
        for f in fin_findings
        if str(f.get("severity") or "").lower() == "high"
        or str(f.get("risk_level") or "").lower() == "high"
    }
    # Also from top_exposures if findings empty (compat)
    for exp in financial.get("top_exposures") or []:
        if str(exp.get("risk_level") or "").lower() == "high":
            fin_high_types.add(_norm(str(exp.get("clause_type") or "")))

    # ── Rule 1: Litigation contradiction ∩ Financial high-risk → bump risk ──
    bumped_clause_types: set[str] = set()
    for contra in contradictions:
        sides = [
            _norm(str(contra.get("clause_a") or "")),
            _norm(str(contra.get("clause_b") or "")),
        ]
        matched_fin = None
        for side in sides:
            for fin_t in fin_high_types:
                if _matches(side, fin_t):
                    matched_fin = fin_t or side
                    break
            if matched_fin:
                break
        if not matched_fin:
            continue

        # Bump matching clauses in the working set
        old_cri = effective_cri
        for clause in clauses:
            ck = _clause_key(clause)
            if any(_matches(ck, s) for s in sides if s) or _matches(ck, matched_fin):
                old_level = str(clause.get("risk_level") or "moderate")
                old_adj = float(clause.get("risk_score_adjusted") or 0)
                new_adj = min(9.0, round(old_adj + 1.5, 3))
                clause["risk_score_adjusted"] = new_adj
                if old_level != "high":
                    clause["risk_level"] = "high"
                clause["requires_legal_review"] = True
                bumped_clause_types.add(ck or matched_fin)
                what_changed.append(
                    f"Risk raised on '{clause.get('clause_type')}' from {old_level} "
                    f"(adj {old_adj}) toward high (adj {new_adj}) due to contradictory "
                    f"terms identified by Litigation Prediction overlapping Financial high risk "
                    f"({contra.get('category')})."
                )

        # Aggregate CRI bump (deterministic fixed step)
        effective_cri = min(100.0, round(effective_cri + 8.0, 2))
        conflicts.append(
            f"Litigation '{contra.get('category')}' conflicts with Financial high-risk "
            f"clause involving {contra.get('clause_a')} / {contra.get('clause_b')}."
        )
        critical_issues.append(
            f"Contradiction ({contra.get('category')}): {contra.get('description', '')[:180]}"
        )
        rules_fired.append("R1_litigation_x_financial_high_bump")
        if effective_cri != old_cri:
            what_changed.append(
                f"Overall CRI raised from {old_cri:.0f} to {effective_cri:.0f} "
                f"due to Litigation∩Financial conflict on liability-related clauses."
            )

    # ── Rule 2: Privacy GDPR-style issue + Financial medium → exposure note ──
    fin_band = _financial_risk_band(financial)
    if _is_gdpr_or_privacy_exposure(privacy) and fin_band in {"moderate", "medium"}:
        note = "Privacy compliance increases the legal exposure."
        supporting.append(note)
        what_changed.append(
            "Chief Review: Privacy/GDPR findings combined with Financial medium risk — "
            + note
        )
        # Mild CRI bump (deterministic)
        old_cri = effective_cri
        effective_cri = min(100.0, round(effective_cri + 4.0, 2))
        if effective_cri != old_cri:
            what_changed.append(
                f"Overall CRI raised from {old_cri:.0f} to {effective_cri:.0f} "
                f"because privacy compliance increases legal exposure alongside medium financial risk."
            )
        critical_issues.append(note)
        rules_fired.append("R2_privacy_gdpr_x_financial_medium")

    # ── Clause overlap across teams (Rules 3 & 4) ───────────────────────────
    team_keys = {
        "Financial Risk Team": _finding_keys(fin_findings)
        | {
            _norm(str(e.get("clause_type") or ""))
            for e in (financial.get("evidence") or [])
            if e.get("clause_type")
        },
        "Privacy / Compliance Team": _finding_keys(priv_findings)
        | {
            _norm(str(e.get("clause_type") or ""))
            for e in (privacy.get("evidence") or [])
            if e.get("clause_type")
        },
        "Litigation Prediction Team": _finding_keys(lit_findings)
        | {
            _norm(str(c.get("clause_a") or ""))
            for c in contradictions
            if c.get("clause_a")
        }
        | {
            _norm(str(c.get("clause_b") or ""))
            for c in contradictions
            if c.get("clause_b")
        },
    }
    # Drop empties
    for t in list(team_keys):
        team_keys[t] = {k for k in team_keys[t] if k}

    # Count how many teams cite each clause key (pairwise match)
    all_keys = set()
    for ks in team_keys.values():
        all_keys |= ks

    multi_team_hits: list[str] = []
    single_team_critical: list[str] = []

    for key in all_keys:
        teams_hit = [
            name
            for name, ks in team_keys.items()
            if any(_matches(key, k) for k in ks)
        ]
        # de-dup team names
        teams_hit = sorted(set(teams_hit))
        if len(teams_hit) >= 2:
            multi_team_hits.append(f"{key} ← {', '.join(teams_hit)}")
            supporting.append(
                f"Independent corroboration: '{key}' flagged by {len(teams_hit)} teams "
                f"({', '.join(teams_hit)})."
            )
        elif len(teams_hit) == 1:
            # Critical if high severity from that team's findings
            is_critical = False
            team = teams_hit[0]
            pool = fin_findings if "Financial" in team else priv_findings if "Privacy" in team else lit_findings
            for f in pool:
                fk = _norm(str(f.get("clause_type") or f.get("id") or ""))
                sev = str(f.get("severity") or f.get("risk_level") or "").lower()
                if _matches(key, fk) and sev in {"high", "critical"}:
                    is_critical = True
                    break
            if not is_critical and "Litigation" in team:
                for c in contradictions:
                    if c.get("severity") == "high" and (
                        _matches(key, _norm(str(c.get("clause_a") or "")))
                        or _matches(key, _norm(str(c.get("clause_b") or "")))
                    ):
                        is_critical = True
                        break
            if is_critical:
                single_team_critical.append(f"{key} (only {team})")

    # Board confidence from specialist confidences
    conf_vals = [float(v) for v in specialist_confidences.values() if v is not None]
    board_confidence = sum(conf_vals) / len(conf_vals) if conf_vals else 0.6

    if multi_team_hits:
        board_confidence = min(0.98, round(board_confidence + 0.08 * min(3, len(multi_team_hits)), 3))
        rules_fired.append("R3_multi_team_corroboration_confidence_up")
        what_changed.append(
            f"Board confidence increased because {len(multi_team_hits)} clause(s) were "
            f"independently identified by multiple teams."
        )

    if single_team_critical:
        board_confidence = max(0.35, round(board_confidence - 0.05 * min(3, len(single_team_critical)), 3))
        rules_fired.append("R4_single_team_critical_confidence_down")
        what_changed.append(
            f"Board confidence reduced slightly: {len(single_team_critical)} critical "
            f"issue(s) identified by only one team (limited corroboration)."
        )

    # Effective risk tier from adjusted CRI (same thresholds as classify_cri, inlined
    # to avoid implying we changed risk_scorer — values match services.risk_scorer.classify_cri)
    if effective_cri <= 30:
        effective_risk_level = "low"
    elif effective_cri <= 70:
        effective_risk_level = "moderate"
    else:
        effective_risk_level = "high"

    if effective_risk_level != base_risk_level or effective_cri != float(base_cri):
        what_changed.append(
            f"Effective overall risk: {base_risk_level} (CRI {base_cri:.0f}) → "
            f"{effective_risk_level} (CRI {effective_cri:.0f}) after cross-team review."
        )

    # High-count after bumps
    high_count = sum(1 for c in clauses if c.get("risk_level") == "high")
    moderate_count = sum(1 for c in clauses if c.get("risk_level") == "moderate")
    low_count = sum(1 for c in clauses if c.get("risk_level") == "low")

    # Signing recommendation (deterministic)
    if effective_risk_level == "high" or high_count >= 3 or len(critical_issues) >= 2:
        signing = f"DO NOT SIGN — {max(high_count, len(critical_issues))} critical issue(s) require resolution"
        recommendation = "Do not sign until critical issues and contradictions are renegotiated."
    elif effective_risk_level == "moderate" or high_count >= 1:
        signing = "SIGN ONLY AFTER LEGAL REVIEW — material risks present"
        recommendation = "Proceed only after counsel reviews flagged clauses and redlines."
    else:
        signing = "PROCEED WITH STANDARD REVIEW — no critical cross-team conflicts"
        recommendation = "Low overall risk; complete standard review before signature."

    # Team contributions (factual, from specialist packages)
    team_contributions = [
        {
            "team": "Financial Risk Team",
            "finding_count": len(fin_findings),
            "confidence": specialist_confidences.get("Financial Risk Team"),
            "summary": financial.get("reasoning_summary")
            or f"Financial subset CRI {financial.get('financial_cri', 0)}",
        },
        {
            "team": "Privacy / Compliance Team",
            "finding_count": len(priv_findings),
            "confidence": specialist_confidences.get("Privacy / Compliance Team"),
            "summary": privacy.get("reasoning_summary")
            or f"Privacy/compliance clauses: {privacy.get('privacy_compliance_clause_count', 0)}",
        },
        {
            "team": "Litigation Prediction Team",
            "finding_count": len(lit_findings) or len(contradictions),
            "confidence": specialist_confidences.get("Litigation Prediction Team"),
            "summary": litigation.get("reasoning_summary")
            or f"Contradictions: {len(contradictions)}",
        },
    ]

    reasoning_summary = " ".join(
        [
            f"Chief Review Board compared three specialist packages.",
            f"Rules fired: {', '.join(rules_fired) or 'none'}.",
            f"Corroborated clauses: {len(multi_team_hits)}.",
            f"Single-team critical: {len(single_team_critical)}.",
            f"Effective risk {effective_risk_level} (CRI {effective_cri:.0f}/100).",
            f"Recommendation: {signing}.",
        ]
    )

    # Evidence bundle for the final report
    evidence_out: list[str] = list(supporting)
    for exp in (financial.get("evidence") or [])[:3]:
        evidence_out.append(
            f"Financial: {exp.get('clause_type')} — {exp.get('detail')}"
        )
    for exp in (privacy.get("evidence") or [])[:3]:
        evidence_out.append(
            f"Privacy: {exp.get('clause_type')} — {exp.get('detail')}"
        )
    for contra in contradictions[:3]:
        evidence_out.append(
            f"Litigation: {contra.get('category')} — {contra.get('description', '')[:160]}"
        )

    # Add remaining high clauses as critical if not already covered
    for c in clauses:
        if c.get("risk_level") == "high":
            msg = f"High-risk clause: {c.get('clause_type')} — {c.get('why_risky', '')}"
            if msg not in critical_issues and len(critical_issues) < 12:
                critical_issues.append(msg[:220])

    return {
        "scored_clauses": clauses,
        "effective_cri": effective_cri,
        "effective_risk_level": effective_risk_level,
        "high_count": high_count,
        "moderate_count": moderate_count,
        "low_count": low_count,
        "board_confidence": board_confidence,
        "signing_recommendation": signing,
        "contract_recommendation": recommendation,
        "critical_issues": critical_issues,
        "supporting_evidence": evidence_out,
        "conflicts": conflicts,
        "what_changed": what_changed,
        "rules_fired": rules_fired,
        "team_contributions": team_contributions,
        "reasoning_summary": reasoning_summary,
        "multi_team_hits": multi_team_hits,
        "single_team_critical": single_team_critical,
    }
