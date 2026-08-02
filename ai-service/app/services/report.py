import json
import re
import urllib.request
from statistics import mean
from typing import Dict, List

from app.services.llm import chat_json
from app.core.config import get_settings


def _groq_report_chat(system_prompt: str, user_prompt: str) -> str:
    """Use the dedicated high-power Groq model for final report generation."""
    settings = get_settings()
    body = json.dumps({
        "model": settings.groq_report_model,
        "messages": [
            {"role": "system", "content": system_prompt + "\nReturn strict valid JSON only. No markdown or commentary."},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "top_p": 0.9,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{settings.groq_base_url.rstrip('/')}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "interview_agent/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=settings.groq_timeout_seconds) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    raw = payload["choices"][0]["message"]["content"]
    # Strip markdown fences if any
    clean = re.sub(r"```(?:json)?\s*", "", raw, flags=re.IGNORECASE).strip().rstrip("`")
    return clean


def _metric(answer: Dict, key: str, fallback: float = 0.0) -> float:
    evaluation = answer.get("evaluation_json") or {}
    try:
        return float(evaluation.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


def _clamp(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def fallback_report(candidate_name: str, job_role: str, ats_score: Dict | None, answers: List[Dict]) -> Dict:
    if answers:
        overall = mean([float(answer.get("score") or _metric(answer, "score", 50)) for answer in answers])
        technical = mean([_metric(answer, "technical_correctness", overall) for answer in answers])
        communication = mean([_metric(answer, "communication_clarity", overall) for answer in answers])
        confidence = mean([_metric(answer, "confidence", overall) for answer in answers])
        problem_solving = mean([_metric(answer, "problem_solving", overall) for answer in answers])
        evidence_depth = mean([_metric(answer, "evidence_depth", overall) for answer in answers])
        answer_structure = mean([_metric(answer, "answer_structure", overall) for answer in answers])
    else:
        overall = technical = communication = confidence = 0.0
        problem_solving = evidence_depth = answer_structure = 0.0

    resume_score = float((ats_score or {}).get("score") or (ats_score or {}).get("ats_score") or 0)
    name_str = candidate_name or "Candidate"
    role_str = job_role or "Software Developer"

    return {
        "candidate_name": name_str,
        "job_role": role_str,
        "overall_score": _clamp(overall),
        "technical_score": _clamp(technical),
        "communication_score": _clamp(communication),
        "confidence_score": _clamp(confidence),
        "resume_relevance_score": _clamp(resume_score),
        "problem_solving_score": _clamp(problem_solving),
        "evidence_depth_score": _clamp(evidence_depth),
        "answer_structure_score": _clamp(answer_structure),
        "strengths": ["Completed a full voice interview flow.", "Resume context was used during evaluation."],
        "weak_areas": ["Answers need more role-specific evidence.", "Some responses can be tighter and more structured."],
        "areas_of_improvement": [
            {"area": "Technical Depth", "priority": "High", "action": "Study core concepts for the target role and practice explaining decisions with trade-offs."},
            {"area": "Communication Clarity", "priority": "Medium", "action": "Structure every answer as: Problem → Approach → Result. Avoid filler words."},
            {"area": "Evidence & Impact", "priority": "High", "action": "Include numbers and measurable outcomes in every project discussion."},
        ],
        "improvements": ["Practice concise STAR answers.", "Add metrics and project impact to technical examples."],
        "detailed_improvements": [
            {"category": "Technical Depth", "score": _clamp(technical), "suggestions": ["Study core concepts for the target role.", "Practice explaining technical decisions with trade-offs."]},
            {"category": "Communication", "score": _clamp(communication), "suggestions": ["Structure answers: problem, approach, result.", "Avoid filler words; be direct and concise."]},
            {"category": "Evidence & Impact", "score": _clamp(evidence_depth), "suggestions": ["Include metrics in every project discussion.", "Quantify your contributions with numbers."]},
        ],
        "roadmap": [
            {"title": "Week 1: Resume alignment", "description": f"Map resume bullets to {role_str} requirements."},
            {"title": "Week 2: Technical depth", "description": "Revise fundamentals and prepare project deep dives."},
            {"title": "Week 3: Mock interviews", "description": "Record answers and improve clarity, pacing, and confidence."},
        ],
        "radar_chart_data": {
            "labels": ["Technical Accuracy", "Communication", "Problem Solving", "Confidence", "Evidence Depth", "Answer Structure"],
            "values": [_clamp(technical), _clamp(communication), _clamp(problem_solving), _clamp(confidence), _clamp(evidence_depth), _clamp(answer_structure)],
        },
        "comparison_percentile": min(95, max(5, int(overall * 0.9))),
        "technical_reasoning_summary": "Complete more technical questions to unlock a detailed reasoning summary.",
        "role_category_scores": {},
    }


def _build_per_question_chart(answers: List[Dict]) -> Dict:
    """Build bar chart data for per-question score breakdown."""
    labels = []
    scores = []
    categories = []

    for answer in answers:
        q_text = str(answer.get("question_text") or "")[:50]
        labels.append(q_text if q_text else f"Q{answer.get('question_index', 0) + 1}")
        scores.append(_clamp(float(answer.get("score") or 0)))
        eval_json = answer.get("evaluation_json") or {}
        categories.append({
            "technical": _clamp(float(eval_json.get("technical_correctness", 0))),
            "communication": _clamp(float(eval_json.get("communication_clarity", 0))),
            "confidence": _clamp(float(eval_json.get("confidence", 0))),
            "relevance": _clamp(float(eval_json.get("relevance", 0))),
            "problem_solving": _clamp(float(eval_json.get("problem_solving", 0))),
            "evidence_depth": _clamp(float(eval_json.get("evidence_depth", 0))),
        })

    return {
        "labels": labels,
        "scores": scores,
        "categories": categories,
    }


def _build_trend_data(answers: List[Dict]) -> Dict:
    """Build trend/trajectory data showing performance across questions."""
    scores = [_clamp(float(a.get("score") or 0)) for a in answers]
    moving_avg = []
    for i in range(len(scores)):
        window = scores[max(0, i - 2):i + 1]
        moving_avg.append(round(sum(window) / len(window), 2))

    return {
        "labels": [f"Q{i + 1}" for i in range(len(scores))],
        "scores": scores,
        "moving_average": moving_avg,
        "trend": "improving" if len(scores) > 2 and scores[-1] > scores[0] else "declining" if len(scores) > 2 and scores[-1] < scores[0] else "stable",
    }


def _build_category_breakdown(answers: List[Dict]) -> List[Dict]:
    """Group scores by question type."""
    type_map: Dict[str, List[float]] = {}
    for answer in answers:
        eval_json = answer.get("evaluation_json") or {}
        q_type = str(eval_json.get("question_type") or "General")
        # Try to get question type from question text pattern
        q_text = str(answer.get("question_text") or "").lower()
        if "project" in q_text:
            q_type = "Project"
        elif any(t in q_text for t in ["design", "architecture", "system"]):
            q_type = "System Design"
        elif any(t in q_text for t in ["debug", "investigate", "troubleshoot"]):
            q_type = "Debugging"

        if q_type not in type_map:
            type_map[q_type] = []
        type_map[q_type].append(float(answer.get("score") or 0))

    return [
        {
            "category": cat,
            "average_score": _clamp(sum(scores) / len(scores)),
            "question_count": len(scores),
            "best_score": _clamp(max(scores)),
            "worst_score": _clamp(min(scores)),
        }
        for cat, scores in type_map.items()
    ]


def generate_final_report(candidate_name: str, job_role: str, parsed_resume: Dict, ats_score: Dict | None, answers: List[Dict]) -> Dict:
    fallback = fallback_report(candidate_name, job_role, ats_score, answers)

    # Build chart data
    bar_chart_data = _build_per_question_chart(answers)
    trend_data = _build_trend_data(answers)
    category_breakdown = _build_category_breakdown(answers)

    answer_scores = [
        {
            "question": answer.get("question_text"),
            "transcription": answer.get("transcription"),
            "score": answer.get("score"),
            "evaluation": answer.get("evaluation_json"),
        }
        for answer in answers
    ]
    name_str = candidate_name or "Candidate"
    role_str = job_role or "Software Developer"
    skills_str = parsed_resume.get("skills", [])

    prompt = f"""You are writing a comprehensive, highly detailed final interview report.

CANDIDATE: {name_str}
ROLE APPLIED FOR: {role_str}
Resume skills: {skills_str}
ATS score: {ats_score}
Answer details and evaluations: {json.dumps(answer_scores, ensure_ascii=False)[:7000]}

Return only valid JSON with these exact keys:
{{
  "candidate_name": "{name_str}",
  "job_role": "{role_str}",
  "overall_score": 0-100,
  "technical_score": 0-100,
  "communication_score": 0-100,
  "confidence_score": 0-100,
  "resume_relevance_score": 0-100,
  "problem_solving_score": 0-100,
  "evidence_depth_score": 0-100,
  "answer_structure_score": 0-100,
  "strengths": ["specific strength citing exact answers given by {name_str}"],
  "weak_areas": ["specific weakness with direct evidence from answers"],
  "areas_of_improvement": [
    {{"area": "specific area name", "priority": "High|Medium|Low", "action": "concrete actionable step for {name_str} to improve before the next interview"}}
  ],
  "improvements": ["actionable improvement step"],
  "detailed_improvements": [
    {{"category": "area name", "score": 0-100, "suggestions": ["specific suggestion 1", "specific suggestion 2"]}}
  ],
  "roadmap": [{{"title":"Week N: Focus area","description":"Concrete action plan for {name_str}"}}],
  "comparison_percentile": 1-99,
  "key_takeaway": "one sentence summary of {name_str}\'s overall interview performance for {role_str}",
  "technical_reasoning_summary": "3-5 sentences synthesizing {name_str}\'s technical depth, algorithmic/system thinking, and recurring gaps across all answers",
  "role_category_scores": {{
    "Software Developer": 0-100,
    "Frontend Developer": 0-100,
    "Backend Developer": 0-100,
    "Advanced Level Coding": 0-100
  }}
}}

CRITICAL SCORING RULES:
- Be realistic and strict, like a senior hiring panel reviewing {name_str} for {role_str}.
- areas_of_improvement MUST have at least 3-5 specific, actionable items tailored to {name_str}\'s actual answers.
- Each area_of_improvement must reference a specific weakness observed in the answers.
- strengths and weak_areas must cite specific topics or answers from the interview.
- Do not inflate scores for vague answers without examples, tradeoffs, or measurable impact.
- technical_reasoning_summary must reference specific answer patterns, missed edge cases, or knowledge gaps seen in {name_str}\'s answers.
- roadmap must be a concrete 4-week plan to help {name_str} improve for {role_str}.
"""

    system = f"You are a strict senior interview panel giving detailed, accurate feedback on {name_str}'s interview for the {role_str} position. Return JSON only."

    try:
        raw = _groq_report_chat(system, prompt)
        result = json.loads(raw)
    except Exception as e:
        print(f"Report generation with high-power model failed: {e}. Using fallback chat_json.")
        result = chat_json(system, prompt, fallback)

    if not isinstance(result, dict):
        result = fallback

    # Ensure candidate identity fields are always set
    result.setdefault("candidate_name", name_str)
    result.setdefault("job_role", role_str)

    # Merge with fallback and add chart data
    merged = {**fallback, **result}
    merged["bar_chart_data"] = bar_chart_data
    merged["trend_data"] = trend_data
    merged["category_breakdown"] = category_breakdown

    # Ensure radar chart data is present
    if "radar_chart_data" not in merged or not merged["radar_chart_data"]:
        merged["radar_chart_data"] = fallback["radar_chart_data"]
    else:
        merged["radar_chart_data"] = {
            "labels": ["Technical Accuracy", "Communication", "Problem Solving", "Confidence", "Evidence Depth", "Answer Structure"],
            "values": [
                _clamp(float(merged.get("technical_score", 0))),
                _clamp(float(merged.get("communication_score", 0))),
                _clamp(float(merged.get("problem_solving_score", 0))),
                _clamp(float(merged.get("confidence_score", 0))),
                _clamp(float(merged.get("evidence_depth_score", 0))),
                _clamp(float(merged.get("answer_structure_score", 0))),
            ],
        }

    return merged
