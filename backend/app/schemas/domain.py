from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentState(StrictModel):
    project_type: str = ""
    business_type: str = ""
    business_goal: str = ""
    target_users: list[str] = Field(default_factory=list)
    requested_features: list[str] = Field(default_factory=list)
    confirmed_requirements: list[str] = Field(default_factory=list)
    missing_requirements: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    integrations: list[str] = Field(default_factory=list)
    budget_range: str | None = None
    timeline_preference: str | None = None
    technical_preferences: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    conversation_stage: Literal[
        "initial_understanding",
        "clarification",
        "requirement_confirmation",
        "scope_generation",
        "completed",
    ] = "initial_understanding"


class FeatureGroup(StrictModel):
    name: str
    items: list[str]


class StackItem(StrictModel):
    name: str
    purpose: str


class Complexity(StrictModel):
    level: Literal["low", "medium", "high"]
    reason: str


class Scope(StrictModel):
    executive_summary: str = Field(min_length=1, max_length=4000)
    business_problem: str
    proposed_solution: str
    target_users: list[str]
    features: list[FeatureGroup]
    user_roles: list[str]
    user_flows: list[str]
    functional_requirements: list[str]
    non_functional_requirements: list[str]
    technical_architecture: str
    suggested_stack: list[StackItem]
    integrations: list[str]
    modules: list[str]
    complexity: Complexity
    assumptions: list[str]
    open_questions: list[str]
    future_enhancements: list[str]


class RequirementData(StrictModel):
    category: str = Field(max_length=80)
    key: str = Field(min_length=1, max_length=100)
    value: str = Field(max_length=3000)
    status: Literal["confirmed", "assumed", "unresolved"]
    source: str = Field(max_length=3000)


class AgentResult(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    reply: str = Field(min_length=1, max_length=6000)
    questions: list[str] = Field(default_factory=list, max_length=4)
    state: AgentState = Field(default_factory=AgentState)
    requirements: list[RequirementData] = Field(default_factory=list, max_length=100)
    scope: Scope | None = None

    @model_validator(mode="after")
    def check_consistency(self):
        if len(self.model_dump_json()) > 48000:
            raise ValueError("Discovery output exceeds the memory budget")
        keys = [item.key for item in self.requirements]
        if len(keys) != len(set(keys)):
            raise ValueError("Requirement keys must be unique")
        if self.state.conversation_stage == "completed" and self.scope is None:
            raise ValueError("Completed discovery requires a scope")
        return self


class CreateProject(StrictModel):
    id: UUID
    title: str = Field(default="Untitled project", min_length=1, max_length=120)


class TurnRequest(StrictModel):
    request_id: UUID
    content: str = Field(min_length=1, max_length=6000)
    section: str | None = None

    @field_validator("content")
    @classmethod
    def nonempty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Please enter a project idea or answer")
        return value.strip()

    @field_validator("section")
    @classmethod
    def known_section(cls, value: str | None) -> str | None:
        if value is not None and value not in Scope.model_fields:
            raise ValueError("Unknown scope section")
        return value


class ProjectPatch(StrictModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def nonempty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Enter a project name")
        return value.strip()
