import json
import re
from typing import Any, Dict

from app.services.llm import chat_json


def _question_text(question: Any) -> str:
    if isinstance(question, str):
        return question
    if isinstance(question, dict):
        return question.get("question") or question.get("text") or ""
    return ""


def fallback_evaluation(answer: str) -> Dict:
    words = re.findall(r"\w+", answer or "")
    lower_answer = (answer or "").lower()
    length_score = min(88, max(20, len(words) * 2))
    structure_bonus = 8 if any(term in lower_answer for term in ["because", "first", "then", "result", "impact"]) else 0
    evidence_bonus = 7 if re.search(r"\d+%?|\busers?\b|\bms\b|\bseconds?\b|\brevenue\b", lower_answer) else 0
    score = min(100, length_score + structure_bonus + evidence_bonus)
    return {
        "score": round(score, 2),
        "technical_correctness": round(score * 0.9, 2),
        "communication_clarity": round(min(100, score + 5), 2),
        "confidence": round(max(35, score - 5), 2),
        "relevance": round(score, 2),
        "problem_solving": round(max(30, score - 3), 2),
        "answer_structure": round(min(100, score + structure_bonus), 2),
        "evidence_depth": round(min(100, score + evidence_bonus), 2),
        "correctness_score": round(score * 0.85, 2),
        "depth_score": round(max(25, score - 10), 2),
        "strengths": ["Answer was captured clearly enough for evaluation."],
        "weak_areas": ["Add more specific examples, metrics, and tradeoffs."],
        "suggestions": ["Use the STAR structure and include one measurable result."],
        "improvement_areas": [
            {"area": "Technical Depth", "current_level": "Basic", "target_level": "Intermediate",
             "action": "Practice explaining concepts with concrete examples and code snippets."},
            {"area": "Evidence & Metrics", "current_level": "Weak", "target_level": "Strong",
             "action": "Include specific numbers, percentages, or measurable outcomes in every answer."},
        ],
        "how_to_improve": [
            "Record yourself answering and listen back for filler words and vagueness.",
            "For every project, prepare: problem, your contribution, tech decisions, and measurable outcome.",
            "Study the STAR method: Situation, Task, Action, Result with numbers.",
        ],
        "ideal_answer_points": [
            "Directly answer the question first.",
            "Explain the technical or behavioral reasoning.",
            "Close with a measurable result or lesson.",
        ],
        "follow_up_probe": "Can you give one concrete example with numbers or impact?",
        "technical_breakdown": "Answer was too brief for a full technical breakdown.",
        "complexity_analysis": "Not enough detail to assess time/space complexity or scalability reasoning.",
        "edge_cases_missed": ["Clarify assumptions and boundary conditions in your answer."],
        "reasoning_depth": round(max(25, score - 15), 2),
    }


def _clamp_score(value: Any, default: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = default
    return round(max(0.0, min(100.0, numeric)), 2)


def _list_value(value: Any, fallback: list[str]) -> list[str]:
    if isinstance(value, list):
        return [str(item) if isinstance(item, str) else json.dumps(item) for item in value if item][:8]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return fallback


def normalize_evaluation(result: Dict, fallback: Dict) -> Dict:
    merged = {**fallback, **result}
    score_keys = [
        "score",
        "technical_correctness",
        "communication_clarity",
        "confidence",
        "relevance",
        "problem_solving",
        "answer_structure",
        "evidence_depth",
        "correctness_score",
        "depth_score",
        "reasoning_depth",
    ]
    for key in score_keys:
        merged[key] = _clamp_score(merged.get(key), fallback.get(key, 50))

    merged["strengths"] = _list_value(merged.get("strengths"), fallback["strengths"])
    merged["weak_areas"] = _list_value(merged.get("weak_areas"), fallback["weak_areas"])
    merged["suggestions"] = _list_value(merged.get("suggestions"), fallback["suggestions"])
    merged["ideal_answer_points"] = _list_value(
        merged.get("ideal_answer_points"),
        fallback["ideal_answer_points"],
    )
    merged["follow_up_probe"] = str(
        merged.get("follow_up_probe") or fallback["follow_up_probe"]
    )

    # Enhanced fields
    merged["improvement_areas"] = merged.get("improvement_areas") or fallback.get("improvement_areas", [])
    merged["how_to_improve"] = _list_value(merged.get("how_to_improve"), fallback.get("how_to_improve", []))
    merged["technical_breakdown"] = str(
        merged.get("technical_breakdown") or fallback.get("technical_breakdown", "")
    ).strip()
    merged["complexity_analysis"] = str(
        merged.get("complexity_analysis") or fallback.get("complexity_analysis", "")
    ).strip()
    merged["edge_cases_missed"] = _list_value(
        merged.get("edge_cases_missed"),
        fallback.get("edge_cases_missed", []),
    )
    merged["reasoning_depth"] = _clamp_score(
        merged.get("reasoning_depth"),
        fallback.get("reasoning_depth", 50),
    )

    return merged


def evaluate_answer(
    question: Any,
    answer: str,
    job_role: str,
    rubric: list[str],
    job_description: str = "",
    parsed_resume: Dict | None = None,
    ats_score: Dict | None = None,
) -> Dict:
    fallback = fallback_evaluation(answer)
    parsed_resume = parsed_resume or {}
    prompt = f"""
Evaluate this interview answer for the role: {job_role}
Question: {_question_text(question)}
Answer: {answer}
Rubric: {", ".join(rubric)}
Job description: {job_description[:2500]}
Resume evidence: {json.dumps({
    "skills": parsed_resume.get("skills", []),
    "projects": parsed_resume.get("projects", []),
    "experience": parsed_resume.get("experience", []),
    "education": parsed_resume.get("education", []),
}, ensure_ascii=False)[:3000]}
ATS context: {json.dumps(ats_score or {}, ensure_ascii=False)[:1500]}

Return only valid JSON:
{{
  "score": 0-100,
  "technical_correctness": 0-100,
  "communication_clarity": 0-100,
  "confidence": 0-100,
  "relevance": 0-100,
  "problem_solving": 0-100,
  "answer_structure": 0-100,
  "evidence_depth": 0-100,
  "correctness_score": 0-100,
  "depth_score": 0-100,
  "reasoning_depth": 0-100,
  "strengths": ["specific strength 1", "specific strength 2"],
  "weak_areas": ["specific weakness 1", "specific weakness 2"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2"],
  "technical_breakdown": "2-4 sentences: why the answer was strong or weak technically — correctness, design, tradeoffs",
  "complexity_analysis": "For coding/system topics: time/space complexity, scalability, bottlenecks; otherwise explain analytical depth",
  "edge_cases_missed": ["edge case or assumption the candidate did not address"],
  "improvement_areas": [
    {{"area": "area name", "current_level": "Basic|Intermediate|Advanced", "target_level": "target", "action": "specific action to improve"}}
  ],
  "how_to_improve": [
    "Concrete step 1 the candidate should take to improve",
    "Concrete step 2 with specific resources or practice methods"
  ],
  "ideal_answer_points": ["what a perfect answer would include"],
  "follow_up_probe": "one concise follow-up question to dig deeper"
}}

Evaluation rules:
- DEEPER REASONING REQUIRED: technical_breakdown must explain WHY the score was given (not generic praise).
- For algorithm/design answers, complexity_analysis must mention Big-O, data structures, or scaling limits when relevant.
- edge_cases_missed must list concrete gaps (null input, concurrency, failure modes, security) when applicable.
- reasoning_depth scores how well the candidate showed structured thinking, tradeoffs, and justification.
- Be strict but supportive, like a senior hiring panel evaluator.
- Penalize vague answers heavily, even if they sound fluent or confident.
- Reward role-specific examples, tradeoffs, measurable impact, and structured reasoning.
- Reward answers that correctly connect resume evidence to the job description.
- Penalize claims that are not supported by the answer or resume context.
- Use strict hiring-panel scoring:
  * 90-100: Exceptional — deep expertise, concrete examples, measurable impact
  * 75-89: Strong — good understanding with some evidence
  * 60-74: Acceptable — basic understanding, lacks depth
  * 40-59: Weak — vague, missing examples, surface-level
  * Below 40: Poor — off-topic, incorrect, or no substance
- If the answer is short, generic, or missing evidence, cap the score at 60 even when confident.
- If the answer does not directly answer the question, cap relevance and overall score at 50.
- Do not invent facts that the candidate did not say.
- improvement_areas must include specific areas with current/target levels and concrete actions.
- how_to_improve must be specific, actionable steps (not generic advice).
- Keep feedback supportive and actionable.
"""
    result = chat_json(
        "You are a strict senior technical interviewer using deep reasoning. Analyze answers like a hiring panel: correctness, complexity, edge cases, and tradeoffs. Return JSON only.",
        prompt,
        fallback,
    )
    if not isinstance(result, dict):
        return fallback
    return normalize_evaluation(result, fallback)
