import math
import re
from functools import lru_cache
from typing import Dict, Iterable, List

import numpy as np


COMMON_STOPWORDS = {
    "and", "or", "the", "a", "an", "to", "for", "with", "of", "in", "on", "by",
    "is", "are", "as", "be", "this", "that", "you", "your", "our", "will",
}


@lru_cache(maxsize=1)
def embedding_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


def tokenize(text: str) -> List[str]:
    return [
        token.lower()
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}", text or "")
        if token.lower() not in COMMON_STOPWORDS
    ]


def keywords(text: str, limit: int = 60) -> List[str]:
    counts: Dict[str, int] = {}
    for token in tokenize(text):
        counts[token] = counts.get(token, 0) + 1
    return [token for token, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]]


def cosine_similarity(left: str, right: str) -> float:
    if not left.strip() or not right.strip():
        return 0.0
    try:
        model = embedding_model()
        vectors = model.encode([left, right], normalize_embeddings=True)
        return float(np.dot(vectors[0], vectors[1]))
    except Exception:
        left_tokens = set(tokenize(left))
        right_tokens = set(tokenize(right))
        if not left_tokens or not right_tokens:
            return 0.0
        return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def score_overlap(required: Iterable[str], available: Iterable[str]) -> float:
    required_set = {item.lower() for item in required if item}
    available_set = {item.lower() for item in available if item}
    if not required_set:
        return 75.0
    return 100.0 * len(required_set & available_set) / len(required_set)


def estimate_experience_score(parsed_resume: Dict) -> float:
    text = parsed_resume.get("raw_text", "")
    years = [int(value) for value in re.findall(r"(\d{1,2})\+?\s+years?", text.lower())]
    if years:
        return min(100.0, max(years) * 18.0)
    if parsed_resume.get("experience"):
        return 70.0
    return 35.0


def formatting_score(parsed_resume: Dict) -> float:
    score = 0
    score += 25 if parsed_resume.get("email") else 0
    score += 20 if parsed_resume.get("phone") else 0
    score += 20 if parsed_resume.get("skills") else 0
    score += 20 if parsed_resume.get("experience") else 0
    score += 15 if parsed_resume.get("education") else 0
    return float(score)


def generate_suggestions(missing_skills: List[str], breakdown: Dict[str, float]) -> List[str]:
    suggestions = []
    if missing_skills:
        suggestions.append(f"Add evidence for these target skills: {', '.join(missing_skills[:8])}.")
    if breakdown["project_match"] < 65:
        suggestions.append("Rewrite projects with measurable outcomes, tech stack, and your exact contribution.")
    if breakdown["experience_match"] < 60:
        suggestions.append("Make experience bullets role-specific and start each bullet with an action verb.")
    if breakdown["formatting_match"] < 80:
        suggestions.append("Add clear contact, skills, education, experience, and project sections.")
    if not suggestions:
        suggestions.append("Resume is aligned; improve impact metrics and role-specific keywords for a higher score.")
    return suggestions


def calculate_ats_score(parsed_resume: Dict, job_role: str, job_description: str) -> Dict:
    resume_text = parsed_resume.get("raw_text", "")
    resume_skills = parsed_resume.get("skills", [])
    jd_keywords = keywords(f"{job_role} {job_description}")

    skill_like_terms = [
        term for term in jd_keywords
        if len(term) > 2 and not term.isnumeric()
    ][:30]

    matched_skills = sorted({skill for skill in resume_skills if skill.lower() in set(skill_like_terms)})
    missing_skills = sorted(set(skill_like_terms) - {skill.lower() for skill in resume_skills})[:12]

    skill_score = score_overlap(skill_like_terms, resume_skills)
    keyword_score = score_overlap(jd_keywords[:40], tokenize(resume_text))
    project_text = " ".join(parsed_resume.get("projects", []))
    project_score = max(0.0, min(100.0, cosine_similarity(project_text, job_description) * 100))
    experience_score = estimate_experience_score(parsed_resume)
    format_score = formatting_score(parsed_resume)

    breakdown = {
        "skill_match": round(skill_score, 2),
        "keyword_match": round(keyword_score, 2),
        "project_match": round(project_score, 2),
        "experience_match": round(experience_score, 2),
        "formatting_match": round(format_score, 2),
    }

    ats_score = (
        breakdown["skill_match"] * 0.40
        + breakdown["keyword_match"] * 0.25
        + breakdown["project_match"] * 0.20
        + breakdown["experience_match"] * 0.10
        + breakdown["formatting_match"] * 0.05
    )

    strengths = []
    if matched_skills:
        strengths.append(f"Resume shows direct evidence for {', '.join(matched_skills[:6])}.")
    if parsed_resume.get("projects"):
        strengths.append("Projects are available for resume-based interview questions.")
    if parsed_resume.get("experience"):
        strengths.append("Experience section gives the interviewer material to validate.")

    return {
        "ats_score": round(max(0.0, min(100.0, ats_score)), 2),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "suggestions": generate_suggestions(missing_skills, breakdown),
        "strengths": strengths or ["Resume has enough structure to begin interview preparation."],
        "breakdown": breakdown,
    }
