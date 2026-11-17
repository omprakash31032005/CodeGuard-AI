
import os
from typing import Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, Field


class Finding(BaseModel):
    title: str
    category: Literal[
        "bug", "security", "performance", "quality"
    ]
    severity: Literal[
        "critical", "high", "medium", "low"
    ]
    line: int | None
    explanation: str
    suggestion: str
    fixed_code: str | None


class ReviewResult(BaseModel):
    quality_score: int = Field(ge=0, le=100)
    summary: str
    findings: list[Finding]
    improved_code: str | None


# OpenAI-compatible local Ollama API
client = AsyncOpenAI(
    base_url="http://127.0.0.1:11434/v1",
    api_key="ollama",
    timeout=180.0,
    max_retries=0,
)


async def analyze_code(code: str, language: str) -> dict:
    response = await client.chat.completions.create(
        model="qwen2.5-coder:7b",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are CodeGuard AI, an expert code reviewer. "
                    "Identify genuine bugs, security vulnerabilities, "
                    "performance issues and quality problems. "
                    "Do not invent problems. "
                    "Return only a JSON object with keys: "
                    "quality_score (integer 0-100), "
                    "summary (string), "
                    "findings (array), "
                    "improved_code (string or null). "
                    "Every finding must contain: title, category "
                    "(bug/security/performance/quality), severity "
                    "(critical/high/medium/low), line (integer or null), "
                    "explanation, suggestion, fixed_code (string or null)."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Review this {language} code:\n\n"
                    f"```{language}\n{code}\n```"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError("Ollama returned an empty response.")

    result = ReviewResult.model_validate_json(content)
    return result.model_dump()
