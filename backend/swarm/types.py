"""
Shared types for the LexGuard OpenSwarm-ready placeholder adapter.

PLACEHOLDER ONLY — not a custom multi-agent framework.
Tomorrow: map AgentResult fields onto official OpenSwarm Agent / message state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class AgentResult:
    """Uniform envelope every team wrapper returns (1:1 swap target for OpenSwarm)."""

    team_name: str
    specialization: str
    status: str  # pending | running | completed | failed
    dependencies: list[str] = field(default_factory=list)
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    duration: float = 0.0  # seconds
    confidence: Optional[float] = None
    reasoning_summary: str = ""
    output: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "team_name": self.team_name,
            "specialization": self.specialization,
            "status": self.status,
            "dependencies": self.dependencies,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration,
            "confidence": self.confidence,
            "reasoning_summary": self.reasoning_summary,
            "output": self.output,
            "error": self.error,
        }


@dataclass
class MatterResult:
    """
    Aggregated analysis payload consumed by services.orchestrator for DB persistence.
    Field names intentionally mirror what run_analysis_pipeline already persisted.
    """

    full_text: str = ""
    page_count: int = 0
    bounding_boxes: list = field(default_factory=list)
    counterparty: str = ""
    jurisdiction: str = ""
    contract_type: str = ""
    scored_clauses: list = field(default_factory=list)
    cri: float = 0.0
    risk_level: str = "moderate"
    high_count: int = 0
    moderate_count: int = 0
    low_count: int = 0
    contradictions: list = field(default_factory=list)
    scenarios: list = field(default_factory=list)
    executive_summary: str = ""
    team_results: list[AgentResult] = field(default_factory=list)
