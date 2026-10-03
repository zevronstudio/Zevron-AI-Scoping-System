"""Validate the single agent's tool result before ending discovery."""

import json
import logging
from types import UnionType
from typing import Any, Union, get_args, get_origin

from agents import AgentOutputSchema, RunContextWrapper
from agents.agent import ToolsToFinalOutputResult
from agents.tool import FunctionTool, FunctionToolResult
from pydantic import BaseModel, ConfigDict, ValidationError

from app.schemas.domain import AgentResult, AgentState, Scope

logger = logging.getLogger(__name__)
MAX_DISCOVERY_TURNS = 3


class DiscoverySubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    result: AgentResult


def is_empty_container(value: Any) -> bool:
    return (
        value is None
        or value == {}
        or (isinstance(value, str) and value.strip().lower() in {"", "none", "null"})
    )


def decode_container_fields(value: Any, annotation: Any) -> Any:
    """Decode JSON-encoded containers only where the declared schema expects one.

    Some compatible tool APIs return arrays/objects as JSON strings. Scalar client
    text is never rewritten; decoded values still pass the complete Pydantic contract.
    """
    options = (
        get_args(annotation) if get_origin(annotation) in (UnionType, Union) else (annotation,)
    )
    model = next(
        (
            option
            for option in options
            if isinstance(option, type) and issubclass(option, BaseModel)
        ),
        None,
    )
    list_type = next((option for option in options if get_origin(option) is list), None)
    if model and type(None) in options and is_empty_container(value):
        return None
    if list_type and is_empty_container(value):
        return []
    if isinstance(value, str) and (model or list_type or type(None) in options):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, RecursionError):
            pass
    if list_type and isinstance(value, str):
        s = value.strip()
        if not s or s.lower() in {"none", "null", "n/a", "[]", "{}"}:
            return []
        lines = [line.strip().lstrip("-*• 0123456789.)").strip() for line in s.splitlines() if line.strip()]
        if len(lines) > 1:
            value = lines
        elif "," in s:
            parts = [p.strip() for p in s.split(",") if p.strip()]
            value = parts if len(parts) > 1 else [s]
        else:
            value = [s]
    if list_type and isinstance(value, dict):
        if not value:
            return []
        inner_type = get_args(list_type)[0] if get_args(list_type) else None
        if inner_type and isinstance(inner_type, type) and issubclass(inner_type, BaseModel):
            if any(f in value for f in inner_type.model_fields):
                value = [value]
            else:
                value = list(value.values())
        else:
            value = [str(v) for v in value.values() if v is not None]
    if model and isinstance(value, dict):
        return {
            key: decode_container_fields(
                []
                if (get_origin(model.model_fields[key].annotation) is list or model.model_fields[key].default_factory is list)
                and is_empty_container(item)
                else item,
                model.model_fields[key].annotation,
            )
            if key in model.model_fields
            else item
            for key, item in value.items()
        }
    if list_type and isinstance(value, list):
        return [decode_container_fields(item, get_args(list_type)[0]) for item in value]
    return value


def normalize_submission_dict(parsed: Any) -> dict[str, Any]:
    if not isinstance(parsed, dict):
        return {"result": parsed}

    if "result" in parsed and isinstance(parsed["result"], dict):
        res = parsed["result"]
    elif any(k in parsed for k in ("title", "reply", "state", "requirements", "questions")):
        res = {k: v for k, v in parsed.items()}
    else:
        res = parsed

    # 1. If 'scope' is at top-level of parsed but not in res:
    if "scope" in parsed and ("scope" not in res or res.get("scope") is None):
        res["scope"] = parsed.pop("scope")

    # 2. Ensure res["requirements"] is initialized as a list
    reqs = res.get("requirements")
    if reqs is None or is_empty_container(reqs):
        res["requirements"] = []
    elif isinstance(reqs, dict):
        if "category" in reqs and "key" in reqs:
            res["requirements"] = [reqs]
        else:
            res["requirements"] = list(reqs.values())
    elif isinstance(reqs, str):
        try:
            loaded = json.loads(reqs)
            res["requirements"] = loaded if isinstance(loaded, list) else [loaded]
        except Exception:
            res["requirements"] = [reqs]

    # If requirement fields ('category', 'key', 'value', 'status', 'source') are at top-level of parsed:
    if "category" in parsed and "key" in parsed:
        req_item = {k: parsed.pop(k) for k in ("category", "key", "value", "status", "source") if k in parsed}
        res["requirements"].append(req_item)

    # If requirement fields are directly on res:
    if "category" in res or "key" in res:
        req_item = {
            "category": str(res.pop("category", "Requirement"))[:80],
            "key": str(res.pop("key", f"req_{len(res['requirements'])+1}"))[:100],
            "value": str(res.pop("value", ""))[:3000],
            "status": res.pop("status", "confirmed") if res.get("status") in {"confirmed", "assumed", "unresolved"} else "confirmed",
            "source": str(res.pop("source", "user"))[:3000],
        }
        res["requirements"].append(req_item)

    # 3. State fields placed on res directly:
    STATE_KEYS = {
        "project_type", "business_type", "business_goal", "target_users",
        "requested_features", "confirmed_requirements", "missing_requirements",
        "constraints", "integrations", "budget_range", "timeline_preference",
        "technical_preferences", "assumptions", "conversation_stage",
    }
    state = res.setdefault("state", {})
    if not isinstance(state, dict):
        state = {}
        res["state"] = state
    for k in list(res.keys()):
        if k in STATE_KEYS:
            state[k] = res.pop(k)

    # Strip any extra unknown fields from state
    allowed_state_fields = {
        "project_type", "business_type", "business_goal", "target_users",
        "requested_features", "confirmed_requirements", "missing_requirements",
        "constraints", "integrations", "budget_range", "timeline_preference",
        "technical_preferences", "assumptions", "conversation_stage",
    }
    for sk in list(state.keys()):
        if sk not in allowed_state_fields:
            state.pop(sk, None)

    # 4. Normalize state list fields
    STATE_LIST_FIELDS = [
        "target_users", "requested_features", "confirmed_requirements",
        "missing_requirements", "constraints", "integrations",
        "technical_preferences", "assumptions"
    ]
    for k in STATE_LIST_FIELDS:
        val = state.get(k)
        if is_empty_container(val):
            state[k] = []

    # 5. Normalize questions
    q_val = res.get("questions")
    if is_empty_container(q_val):
        res["questions"] = []

    # 6. Normalize requirements
    normalized_reqs = []
    seen_keys = set()
    for idx, item in enumerate(res.get("requirements", [])):
        if isinstance(item, str):
            item_str = item.strip()
            if not item_str:
                continue
            if item_str.startswith("{") and item_str.endswith("}"):
                try:
                    loaded_item = json.loads(item_str)
                    if isinstance(loaded_item, dict):
                        item = loaded_item
                except Exception:
                    pass
            if isinstance(item, str):
                k = f"req_{idx+1}"
                normalized_reqs.append({
                    "category": "Requirement",
                    "key": k,
                    "value": item_str[:3000],
                    "status": "confirmed",
                    "source": "client",
                })
                seen_keys.add(k)
                continue

        if isinstance(item, dict):
            allowed_req_keys = {"category", "key", "value", "status", "source"}
            for ik in list(item.keys()):
                if ik not in allowed_req_keys:
                    item.pop(ik, None)
            cat = str(item.get("category") or "Requirement")[:80]
            val = str(item.get("value") or "")[:3000]
            status = item.get("status") if item.get("status") in {"confirmed", "assumed", "unresolved"} else "confirmed"
            src = str(item.get("source") or "client")[:3000]
            k = str(item.get("key") or f"req_{idx+1}")[:100]
            if k in seen_keys:
                k = f"{k}_{idx+1}"
            seen_keys.add(k)
            normalized_reqs.append({
                "category": cat,
                "key": k,
                "value": val,
                "status": status,
                "source": src,
            })
    res["requirements"] = normalized_reqs

    # 7. Normalize scope
    scope_val = res.get("scope")
    if is_empty_container(scope_val):
        res["scope"] = None

    # 8. Strip any extra unknown fields from res to eliminate extra_forbidden
    allowed_result_fields = {"title", "reply", "questions", "state", "requirements", "scope"}
    for extra_key in list(res.keys()):
        if extra_key not in allowed_result_fields:
            res.pop(extra_key, None)

    return {"result": res}


async def validate_submission(_context: RunContextWrapper[Any], arguments: str) -> str:
    try:
        raw_text = arguments.strip() if isinstance(arguments, str) else arguments
        if isinstance(raw_text, str) and raw_text.startswith("```"):
            lines = raw_text.splitlines()
            if len(lines) >= 3 and lines[-1].strip() == "```":
                raw_text = "\n".join(lines[1:-1]).strip()
        parsed = json.loads(raw_text)
        normalized = normalize_submission_dict(parsed)
        decoded = decode_container_fields(normalized, DiscoverySubmission)
        submission = DiscoverySubmission.model_validate(decoded)
        return submission.result.model_dump_json()
    except (json.JSONDecodeError, RecursionError) as error:
        return invalid_discovery_feedback(_context, error)
    except ValidationError as error:
        # Pydantic input/ctx can contain client content; only return schema error descriptions.
        allowed_fields = {
            "result",
            "name",
            "items",
            "purpose",
            "level",
            "reason",
            "category",
            "key",
            "value",
            "status",
            "source",
            *AgentResult.model_fields,
        }
        allowed_fields.update(AgentState.model_fields)
        allowed_fields.update(Scope.model_fields)
        issues = []
        for issue in error.errors(include_input=False, include_context=False, include_url=False)[
            :12
        ]:
            path = ".".join(
                str(part) if isinstance(part, int) or part in allowed_fields else "(unknown field)"
                for part in issue["loc"]
            )
            issues.append(f"{path or 'result'}: {issue['type']}")
        logger.warning(
            "Discovery result rejected; requesting correction (ValidationError): %s", issues
        )
        return (
            invalid_discovery_feedback(_context, error)
            + "\nFields to correct: "
            + "; ".join(issues)
        )


submit_discovery = FunctionTool(
    name="submit_discovery",
    description="Return the validated discovery state and optional project brief.",
    params_json_schema=AgentOutputSchema(DiscoverySubmission).json_schema(),
    on_invoke_tool=validate_submission,
)


def invalid_discovery_feedback(_context: RunContextWrapper[Any], error: Exception) -> str:
    # Never echo provider payloads, client content, or raw exception messages.
    logger.warning("Discovery result rejected; requesting correction (%s)", type(error).__name__)
    return (
        "The discovery result failed schema validation. Correct it and call submit_discovery "
        "again, wrapping the complete object in result. Include title, reply, questions, state, "
        "requirements and scope. Use only schema-defined fields, types and enum values. "
        "Questions must contain at most four strings. Requirement keys must be unique. "
        "Use JSON arrays for every list field, [] for an empty list, and strings as list items "
        "unless the schema explicitly requires objects. Do not use null or strings for lists. "
        "Set scope to null during clarification; completed requires a full scope. "
        "Keep the client's facts unchanged and do not invent missing information."
    )


def finish_valid_discovery(
    _context: RunContextWrapper[Any], results: list[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    for result in results:
        if result.tool.name != "submit_discovery":
            continue
        try:
            parsed = AgentResult.model_validate_json(result.output)
        except (ValidationError, TypeError):
            continue
        # A text-output agent coerces custom final objects to repr; preserve actual JSON.
        return ToolsToFinalOutputResult(is_final_output=True, final_output=parsed.model_dump_json())
    # The same agent receives the safe validation feedback and can repair the output.
    return ToolsToFinalOutputResult(is_final_output=False)
