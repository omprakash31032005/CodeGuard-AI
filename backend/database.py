
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent / "codeguard.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                language TEXT NOT NULL,
                code TEXT NOT NULL,
                quality_score INTEGER NOT NULL,
                summary TEXT NOT NULL,
                findings TEXT NOT NULL,
                improved_code TEXT,
                created_at TEXT NOT NULL
            )
        """)


def save_review(code: str, language: str, result: dict) -> int:
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO reviews (
                language, code, quality_score, summary,
                findings, improved_code, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                language,
                code,
                result["quality_score"],
                result["summary"],
                json.dumps(result["findings"]),
                result.get("improved_code"),
                created_at,
            ),
        )
        return cursor.lastrowid


def get_reviews(limit: int = 50) -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM reviews
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    reviews = []
    for row in rows:
        review = dict(row)
        review["findings"] = json.loads(review["findings"])
        reviews.append(review)

    return reviews


def get_review_stats() -> dict:
    with get_connection() as connection:
        row = connection.execute("""
            SELECT
                COUNT(*) AS total_reviews,
                COALESCE(AVG(quality_score), 0) AS average_score
            FROM reviews
        """).fetchone()

        issue_rows = connection.execute(
            "SELECT findings FROM reviews"
        ).fetchall()

    total_issues = sum(
        len(json.loads(item["findings"]))
        for item in issue_rows
    )

    return {
        "total_reviews": row["total_reviews"],
        "total_issues": total_issues,
        "average_score": round(row["average_score"], 1),
    }


if __name__ == "__main__":
    initialize_database()
    print(f"Database initialized successfully: {DATABASE_PATH}")
