"""Document Intelligence Team — wraps services.parser only."""

from __future__ import annotations

from typing import Any

from config import settings
from services.parser import DocumentParser
from swarm.runtime import run_timed
from swarm.types import AgentResult

TEAM_NAME = "Document Intelligence Team"
SPECIALIZATION = "Extracts text, layout, counterparty, and jurisdiction from the upload"


async def run_document_intelligence(context: dict[str, Any]) -> AgentResult:
    async def work():
        # Existing implementation — no logic copied here.
        parsed = DocumentParser.parse(
            context["file_path"],
            upload_dir=settings.UPLOAD_DIR,
        )
        output = {
            "full_text": parsed.full_text,
            "page_count": parsed.page_count,
            "chunks": parsed.chunks,
            "bounding_boxes": parsed.bounding_boxes or [],
            "counterparty": parsed.counterparty or "",
            "jurisdiction": parsed.jurisdiction or "",
        }
        if not (parsed.full_text or "").strip():
            raise ValueError("Could not extract text from document.")
        reasoning = (
            f"Parsed upload into {parsed.page_count} page(s); "
            f"counterparty='{output['counterparty'] or 'unknown'}', "
            f"jurisdiction='{output['jurisdiction'] or 'unspecified'}'."
        )
        confidence = 0.9 if len(parsed.full_text) > 200 else 0.6
        return output, reasoning, confidence

    return await run_timed(
        team_name=TEAM_NAME,
        specialization=SPECIALIZATION,
        dependencies=["Chief Legal Officer"],
        work=work,
    )
