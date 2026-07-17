# OpenSwarm Integration Status — LexGuard (Stage 0)

**Date:** 2026-07-17  
**Project root checked:** `C:\Users\BhaviChasvi\Downloads\lexguard`  
**Verdict:** OpenSwarm is **NOT** installed, importable, or wired into LexGuard.

---

## What was checked (real environment)

| Check | Result |
|-------|--------|
| `backend/requirements.txt` | No `openswarm`, `openswarm-ai`, `open-swarm`, `agency-swarm`, or `swarm` |
| LexGuard `.venv` (`importlib.find_spec`) | `openswarm`, `openswarm_ai`, `open_swarm`, `openswarm_os`, `agency_swarm`, `swarm`, `agents` → **all False** |
| System / PATH CLI | `openswarm` / `swarm` → **not found** |
| Project files | No `team.yaml`, no OpenSwarm config, no OpenSwarm docs folder inside LexGuard |
| Code references | No imports/usages of OpenSwarm in LexGuard services |

LexGuard’s current multi-step flow lives in **custom** code: `backend/services/orchestrator.py` calling `parser`, `rag_engine`, `risk_scorer`, `contradiction_detector`, `report_builder`, etc.

---

## Nearby OpenSwarm artifacts (NOT integrated)

A separate download exists at:

`C:\Users\BhaviChasvi\Downloads\OpenSwarm-main\OpenSwarm-main\`

This is **VRSEN OpenSwarm** (`pyproject.toml` name: `open-swarm`), built on **Agency Swarm** + OpenAI Agents SDK. It is a full product (TUI / agency of research, slides, docs, video agents) — **not** currently installed into LexGuard’s venv.

### Real API surface found there (quoted)

From `swarm.py`:

```python
def create_agency(load_threads_callback=None):
    from agency_swarm import Agency
    from agency_swarm.tools import Handoff, SendMessage
    # ... create_* agent factories ...
    agency = Agency(
        *all_agents,
        communication_flows=send_message_flows + handoff_flows,
        name="OpenSwarm",
        shared_instructions="shared_instructions.md",
        load_threads_callback=load_threads_callback,
    )
    return agency
```

Entry points from `pyproject.toml`:

- CLI script: `openswarm = "run_utils:main"`
- Package depends on: `agency-swarm[fastapi,jupyter,litellm]>=1.10.2`

This model is **LLM conversational agents with handoffs/SendMessage**, not a thin wrapper API for “run these existing Python services in parallel and report status.”

Separately, PyPI **`openswarm-ai`** is an IDE/MCP coding-team tool (`team.yaml` + `openswarm run "..."`) — wrong product shape for LexGuard’s contract-analysis FastAPI pipeline.

---

## What’s missing for LexGuard

1. OpenSwarm (or `agency-swarm`) not in LexGuard dependencies / venv  
2. No LexGuard-facing SDK usage for: agent lifecycle, messaging, state, approval, visualization  
3. No official “wrap existing sync/async Python analyzers as OpenSwarm agents” path verified in-repo  
4. Tomorrow’s **11am official setup** may provide a different OpenSwarm distribution than the VRSEN download

---

## Fit risk (honest)

Even if we `pip install` the nearby VRSEN OpenSwarm / Agency Swarm tonight:

- It expects **LLM agents** that talk via `SendMessage` / `Handoff`
- LexGuard’s value is **existing deterministic + LLM-assisted services** (parse → classify → extract → score → contradict → report)
- Forcing Agency Swarm around those services may **not** give native parallel lifecycle/visualization for free — and could break the “don’t rewrite working logic” rule

Until the official OpenSwarm package/docs from the hackathon are available, we **cannot** truthfully claim “powered by OpenSwarm’s native orchestration.”

---

## Decision required (Stage 0 gate)

Per instructions, choose one:

**(a)** Wait for tomorrow’s **11am official OpenSwarm setup**, then wire LexGuard to the real SDK.

**(b)** Proceed with a **clearly labeled placeholder orchestration layer** (e.g. `PLACEHOLDER_ORCHESTRATION` / `LexGuard Swarm Adapter`) that:
- wraps existing services as named “legal org” teams,
- supports real `asyncio` parallelism where data allows,
- exposes the same contracts we will later swap to OpenSwarm,
- **never** claims native OpenSwarm lifecycle/approval/visualization until the real SDK is present.

**Default if you don’t answer:** **(b)** — so the 3-hour sprint can still produce a demable AI Legal Organization UI with honest labeling.

---

## Stage 0 complete — STOP

No LexGuard application code was modified in Stage 0 (only this file was added).
