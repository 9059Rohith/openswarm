"""
Tiny timing helper for placeholder agent wrappers.

Not an agent framework — only start/end clocks around existing service calls.
# OPENSWARM_SWAP: replace with OpenSwarm native lifecycle timing/status if provided.
"""

from __future__ import annotations

import time
from typing import Awaitable, Callable, Optional

from swarm.types import AgentResult


async def run_timed(
    *,
    team_name: str,
    specialization: str,
    dependencies: list[str],
    work: Callable[[], Awaitable[tuple[dict, str, Optional[float]]]],
) -> AgentResult:
    """
    Execute `work`, which must return (output_dict, reasoning_summary, confidence).
    """
    result = AgentResult(
        team_name=team_name,
        specialization=specialization,
        status="running",
        dependencies=dependencies,
        start_time=time.time(),
    )
    try:
        output, reasoning, confidence = await work()
        result.output = output
        result.reasoning_summary = reasoning
        result.confidence = confidence
        result.status = "completed"
    except Exception as exc:  # noqa: BLE001 — surface team failure without crashing sibling gathers
        result.status = "failed"
        result.error = str(exc)[:500]
        result.reasoning_summary = f"{team_name} failed: {exc}"
        result.output = {}
    finally:
        result.end_time = time.time()
        if result.start_time is not None:
            result.duration = round(result.end_time - result.start_time, 4)
    return result
