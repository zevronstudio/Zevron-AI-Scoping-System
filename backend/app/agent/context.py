import json

from app.agent.prompts import TASKS


def build_context(project: dict, content: str, mode: str, section: str | None) -> str:
    context = {
        "task": TASKS.get(mode, TASKS["scope"] if mode in ("scope", "brief") else TASKS["message"]),
        "requested_section": section,
        "structured_memory": project["state"],
        "requirements": project["requirements"],
        "current_scope": project["scopes"][0]["data"] if project["scopes"] else None,
        "recent_messages": [],
        "client_message": content,
    }
    # Full validated memory has a 48K character output budget. Recent prose is supplemental.
    remaining = max(0, 64000 - len(json.dumps(context, ensure_ascii=False)))
    recent = []
    for message in reversed(project["messages"][-12:]):
        entry = {
            "role": message["role"],
            "content": message["content"][-2000:],
            "questions": message["questions"],
        }
        size = len(json.dumps(entry, ensure_ascii=False))
        if size > remaining:
            break
        recent.insert(0, entry)
        remaining -= size
    context["recent_messages"] = recent
    return json.dumps(context, ensure_ascii=False)
