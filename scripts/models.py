"""
scripts/models.py
=================
Pydantic V2 models mirroring TypeScript interfaces field-for-field.
Enforces rigorous validation before any JSON document can be written or uploaded to the CDN.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator
import re


class Concept(BaseModel):
    id: str
    label: str


class Resource(BaseModel):
    title: str
    url: str
    type: Literal["article", "video", "docs", "course"]


class NodePosition(BaseModel):
    branch: int = 0
    order: int = 0


class RoadmapNode(BaseModel):
    id: str
    title: str
    description: str
    status: Literal["completed", "in-progress", "planned"]
    track: Literal["frontend", "backend", "mobile", "fullstack"]
    depth: int
    parentIds: List[str] = Field(default_factory=list)
    children: List[str] = Field(default_factory=list)
    concepts: List[Concept] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)
    resources: List[Resource] = Field(default_factory=list)
    position: Optional[NodePosition] = None


class RoadmapDocument(BaseModel):
    roadmapId: str
    version: int = 1
    generatedAt: str
    nodes: List[RoadmapNode]

    @field_validator("nodes")
    @classmethod
    def validate_non_empty_nodes(cls, v: List[RoadmapNode]) -> List[RoadmapNode]:
        if not v:
            raise ValueError("RoadmapDocument must contain at least one node.")
        # Ensure node IDs are unique
        ids = set()
        for node in v:
            if node.id in ids:
                raise ValueError(f"Duplicate RoadmapNode id found: {node.id}")
            ids.add(node.id)
        return v


class PracticeQuestion(BaseModel):
    id: str
    track: Literal["frontend", "backend", "mobile", "fullstack"]
    question: str
    options: Optional[List[str]] = None
    answerType: Literal["mcq", "short"]
    answer: str
    explanation: str
    difficulty: Literal["easy", "medium", "hard"]
    tags: List[str] = Field(default_factory=list)

    @field_validator("options")
    @classmethod
    def validate_options_for_mcq(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        answer_type = info.data.get("answerType")
        if answer_type == "mcq":
            if not v or len(v) < 2:
                raise ValueError("MCQ questions must provide at least 2 options.")
        return v


class DailyPracticeDocument(BaseModel):
    date: str
    track: Literal["frontend", "backend", "mobile", "fullstack"]
    questions: List[PracticeQuestion]

    @field_validator("date")
    @classmethod
    def validate_iso_date(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError(f"Date must follow YYYY-MM-DD format, got: '{v}'")
        return v

    @field_validator("questions")
    @classmethod
    def validate_exactly_10(cls, v: List[PracticeQuestion]) -> List[PracticeQuestion]:
        if len(v) != 10:
            raise ValueError(
                f"DailyPracticeDocument must contain exactly 10 questions. Found {len(v)}."
            )
        # Ensure unique question IDs
        ids = set()
        for q in v:
            if q.id in ids:
                raise ValueError(f"Duplicate PracticeQuestion id found: {q.id}")
            ids.add(q.id)
        return v
