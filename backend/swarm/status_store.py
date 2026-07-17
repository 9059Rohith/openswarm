"""
In-memory swarm status store — tracks real-time team progress during analysis.

Lives only in RAM: no DB schema changes required.
Entries auto-expire when the orchestrator completes or errors.
"""

from __future__ import annotations

import time
import threading
from typing import Any, Optional


_lock = threading.Lock()
_store: dict[str, dict[str, Any]] = {}


def init_contract(contract_id: str, teams: list[dict[str, Any]]) -> None:
    """Initialize tracking for a new contract analysis."""
    with _lock:
        _store[contract_id] = {
            "started_at": time.time(),
            "completed_at": None,
            "teams": {t["team_name"]: t for t in teams},
            "status": "running",
        }


def update_team(contract_id: str, team_name: str, **kwargs: Any) -> None:
    """Update a single team's status fields."""
    with _lock:
        entry = _store.get(contract_id)
        if not entry:
            return
        team = entry["teams"].get(team_name)
        if team:
            team.update(kwargs)


def mark_complete(contract_id: str) -> None:
    """Mark the entire analysis as complete."""
    with _lock:
        entry = _store.get(contract_id)
        if entry:
            entry["status"] = "complete"
            entry["completed_at"] = time.time()


def mark_failed(contract_id: str) -> None:
    """Mark the entire analysis as failed."""
    with _lock:
        entry = _store.get(contract_id)
        if entry:
            entry["status"] = "failed"
            entry["completed_at"] = time.time()


def store_final_results(contract_id: str, team_results: list[dict[str, Any]]) -> None:
    """Store the finalized team results after analysis completes."""
    with _lock:
        entry = _store.get(contract_id)
        if not entry:
            _store[contract_id] = {
                "started_at": time.time(),
                "completed_at": time.time(),
                "teams": {},
                "status": "complete",
                "final_results": team_results,
            }
        else:
            entry["final_results"] = team_results
            entry["status"] = "complete"
            entry["completed_at"] = time.time()


def get_status(contract_id: str) -> Optional[dict[str, Any]]:
    """Get the current swarm status for a contract."""
    with _lock:
        entry = _store.get(contract_id)
        if not entry:
            return None
        return {
            "status": entry["status"],
            "started_at": entry["started_at"],
            "completed_at": entry["completed_at"],
            "teams": list(entry["teams"].values()),
            "final_results": entry.get("final_results"),
        }


def cleanup(contract_id: str) -> None:
    """Remove entry (called after results are persisted to prevent memory leaks)."""
    with _lock:
        _store.pop(contract_id, None)


def cleanup_stale(max_age_seconds: int = 3600) -> None:
    """Remove entries older than max_age_seconds."""
    cutoff = time.time() - max_age_seconds
    with _lock:
        stale = [k for k, v in _store.items() if v["started_at"] < cutoff]
        for k in stale:
            del _store[k]
