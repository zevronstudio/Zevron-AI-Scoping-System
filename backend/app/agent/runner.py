import asyncio
import logging

from agents import Agent, ModelSettings, RunConfig, Runner
from agents.exceptions import MaxTurnsExceeded, ModelBehaviorError
from agents.models.openai_chatcompletions import OpenAIChatCompletionsModel
from agents.models.openai_responses import OpenAIResponsesModel
from openai import AsyncOpenAI
from pydantic import ValidationError

from app.agent.context import build_context
from app.agent.output import (
    MAX_DISCOVERY_TURNS,
    finish_valid_discovery,
    submit_discovery,
)
from app.agent.prompts import SYSTEM_INSTRUCTIONS
from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.domain import AgentResult

logger = logging.getLogger(__name__)


async def run_discovery(project: dict, content: str, mode: str, section: str | None) -> AgentResult:
    settings = get_settings()
    if not settings.discovery_available:
        raise AppError(
            503, "agent_unconfigured", "Discovery is not configured yet. Please contact the studio."
        )
    try:
        base_url = (
            settings.llm_base_url
            if settings.llm_provider != "openai"
            else "https://api.openai.com/v1"
        )
        async with AsyncOpenAI(
            api_key=settings.provider_api_key, base_url=base_url, max_retries=0
        ) as client:
            model_type = (
                OpenAIChatCompletionsModel
                if settings.llm_provider != "openai"
                else OpenAIResponsesModel
            )
            agent = Agent(
                name="Zevron project advisor",
                instructions=SYSTEM_INSTRUCTIONS,
                model=model_type(model=settings.llm_model, openai_client=client),
                output_type=None if settings.llm_provider == "minimax" else AgentResult,
            )
            if settings.llm_provider == "minimax":
                agent.instructions += (
                    "\nReturn your complete result by calling submit_discovery. "
                    "Do not put project data or reasoning in a plain-text response. "
                    "If validation fails, correct the result using the tool feedback. "
                    "During discovery return scope=null, not an empty scope object."
                )
                agent.tools = [submit_discovery]
                agent.tool_use_behavior = finish_valid_discovery
                agent.reset_tool_choice = False
                agent.model_settings = ModelSettings(
                    tool_choice="submit_discovery",
                    parallel_tool_calls=False,
                    extra_body={"reasoning_split": True},
                )
            async with asyncio.timeout(settings.agent_timeout_seconds):
                result = await Runner.run(
                    agent,
                    build_context(project, content, mode, section),
                    max_turns=MAX_DISCOVERY_TURNS if settings.llm_provider == "minimax" else 1,
                    run_config=RunConfig(tracing_disabled=True),
                )
            if isinstance(result.final_output, str):
                return AgentResult.model_validate_json(result.final_output)
            return AgentResult.model_validate(result.final_output)
    except TimeoutError as exc:
        raise AppError(
            504, "agent_timeout", "The advisor took too long. Your project is safe; please retry."
        ) from exc
    except AppError:
        raise
    except (ValidationError, MaxTurnsExceeded, ModelBehaviorError) as exc:
        logger.warning("Discovery output remained invalid (%s)", type(exc).__name__)
        raise AppError(
            502,
            "invalid_agent_response",
            "The advisor could not format this response correctly. "
            "Your project is safe; please retry.",
        ) from exc
    except Exception as exc:
        logger.warning("Discovery failed (%s)", type(exc).__name__)
        raise AppError(
            502, "agent_error", "The advisor could not complete this request. Please retry."
        ) from exc
