"""
Image Quality Agent — CropGuard Agentic AI
No LLM call — fast file-based validation only.
Gemini quota is reserved for the Diagnosis agent (the expensive vision call).
Quality assessment is inferred structurally; the Diagnosis agent reports what it sees.
"""
from __future__ import annotations
import os
from pathlib import Path


MIN_FILE_BYTES = 5_000     # < 5 KB is almost certainly corrupt / blank
MIN_GOOD_BYTES = 30_000    # ≥ 30 KB assumed to have enough image detail


def _fallback(reason: str) -> dict:
    return {
        "quality_score": 0.3,
        "scores": {},
        "usable": False,
        "enhancement_notes": reason,
        "suggestions": [
            "Retake photos in natural daylight — avoid flash and shadows",
            "Take one whole-plant photo from ~1 m distance",
            "Take one close-up of the affected leaf/stem from ~20 cm",
        ],
        "per_image": [],
    }


async def run_image_quality_agent(images: list[dict]) -> dict:
    """
    Validates image files structurally.
    Returns a quality dict that passes the 0.6 gate for any readable image
    so the Diagnosis agent (Gemini vision) can do the real assessment.
    """
    if not images:
        return _fallback("No images provided — please upload at least one photo")

    per_image = []
    readable  = 0

    for i, img in enumerate(images):
        path = img.get("path", "")
        view = img.get("type", "unknown")
        try:
            size = os.path.getsize(path)
            ext  = Path(path).suffix.lower()

            if size < MIN_FILE_BYTES:
                score, issues = 0.3, ["Image too small — may be blank or corrupt"]
            elif ext in (".heic", ".heif"):
                score, issues = 0.4, ["HEIC format — conversion may reduce quality"]
            elif size >= MIN_GOOD_BYTES:
                score, issues = 0.82, []
            else:
                score, issues = 0.65, ["Image size is marginal — close-up preferred"]

            per_image.append({
                "index": i, "type": view,
                "quality_score": score,
                "usable": score >= 0.6,
                "issues": issues,
                "visible_symptoms": "To be determined by diagnosis agent",
            })
            if score >= 0.6:
                readable += 1

        except Exception as exc:
            per_image.append({
                "index": i, "type": view, "quality_score": 0.0,
                "usable": False, "issues": [f"Cannot read file: {exc}"],
                "visible_symptoms": "",
            })

    if readable == 0:
        return {
            "quality_score": 0.3,
            "scores": {}, "usable": False,
            "enhancement_notes": "No readable images found — please re-upload clear crop photos",
            "suggestions": ["Ensure images are JPG, PNG, or WebP and under 10 MB"],
            "per_image": per_image,
        }

    avg_score = sum(p["quality_score"] for p in per_image) / len(per_image)

    return {
        "quality_score": round(avg_score, 2),
        "scores": {},
        "usable": avg_score >= 0.6,
        "enhancement_notes": (
            f"{readable}/{len(images)} image(s) readable and structurally valid. "
            "Gemini vision will assess diagnostic content."
        ),
        "suggestions": [],
        "per_image": per_image,
    }
