
import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAIError
from pydantic import BaseModel, Field, ValidationError

from ai_reviewer import analyze_code
from database import (
    initialize_database,
    save_review,
    get_reviews,
    get_review_stats,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="CodeGuard AI API",
    description="AI-powered intelligent code review assistant",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ReviewRequest(BaseModel):
    code: str = Field(min_length=1, max_length=20000)
    language: str = "python"


@app.get("/")
def home():
    return {
        "message": "CodeGuard AI Backend Running",
        "status": "online",
        "version": "1.1.0",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/review")
async def review_code(request: ReviewRequest):
    language = request.language.lower()

    if language not in ["python", "javascript"]:
        raise HTTPException(
            status_code=400,
            detail="Only Python and JavaScript are supported.",
        )

    try:
        result = await analyze_code(
            code=request.code,
            language=language,
        )

    except OpenAIError as exc:
        logger.error("Ollama request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "Local AI service unavailable. "
                "Check that Ollama is running and "
                "qwen2.5-coder:7b is installed."
            ),
        ) from exc

    except (ValueError, ValidationError) as exc:
        logger.error("Invalid AI response: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid review.",
        ) from exc

    try:
        review_id = save_review(
            code=request.code,
            language=language,
            result=result,
        )
    except (sqlite3.Error, OSError) as exc:
        logger.exception("Failed to save review")
        raise HTTPException(
            status_code=500,
            detail="Review generated, but could not be saved.",
        ) from exc

    return {
        **result,
        "review_id": review_id,
    }


@app.get("/reviews")
def review_history():
    try:
        return get_reviews(limit=50)
    except (sqlite3.Error, ValueError) as exc:
        logger.exception("Failed to load review history")
        raise HTTPException(
            status_code=500,
            detail="Could not load review history.",
        ) from exc


@app.get("/stats")
def dashboard_stats():
    try:
        return get_review_stats()
    except (sqlite3.Error, ValueError) as exc:
        logger.exception("Failed to load statistics")
        raise HTTPException(
            status_code=500,
            detail="Could not load dashboard statistics.",
        ) from exc
