"""Export real visible conversation records without system instructions/internal reasoning.

Usage: python3 scripts/export-conversation.py /absolute/path/to/current-session.jsonl
The original brief is separately preserved verbatim in docs/original-brief.txt.
"""

import json
import sys
from pathlib import Path

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
count = 0
with (root / "docs/ai-conversation.jsonl").open("w") as output:
    for line in source.open():
        record = json.loads(line)
        if record.get("type") != "response_item":
            continue
        payload = record.get("payload", {})
        kind = payload.get("type")
        visible_message = (
            kind == "message"
            and payload.get("role") in ("user", "assistant")
            and payload.get("channel") not in ("analysis", "summary")
        )
        visible_tool = kind in (
            "custom_tool_call",
            "custom_tool_call_output",
            "function_call",
            "function_call_output",
        )
        if visible_message or visible_tool:
            output.write(line)
            count += 1
print(
    f"Exported {count} genuine timestamped message/tool records. Internal reasoning, system instructions and session metadata excluded. Snapshot ends at export time."
)
