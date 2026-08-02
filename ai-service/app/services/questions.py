import json
from typing import Dict, List

from app.services.knowledge_base import retrieve_context
from app.services.llm import chat_json


def _short_items(items: list, limit: int = 4) -> list[str]:
    return [str(item).strip()[:180] for item in items if str(item).strip()][:limit]


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in "".join(
            char.lower() if char.isalnum() or char in {".", "#", "+"} else " "
            for char in str(text)
        ).split()
        if len(token) > 3
    }


def _resume_evidence_pool(parsed_resume: Dict | None) -> Dict[str, List[str]]:
    parsed_resume = parsed_resume or {}
    return {
        "skills": _short_items(parsed_resume.get("skills", []), 12),
        "projects": _short_items(parsed_resume.get("projects", []), 6),
        "experience": _short_items(parsed_resume.get("experience", []), 6),
        "education": _short_items(parsed_resume.get("education", []), 4),
        "certifications": _short_items(parsed_resume.get("certifications", []), 4),
    }


def _infer_resume_evidence(question: Dict[str, str], parsed_resume: Dict | None) -> str:
    existing = str(question.get("resumeEvidence") or question.get("resume_evidence") or "").strip()
    question_text = str(question.get("question") or "")
    question_tokens = _tokens(question_text)
    question_type = str(question.get("type") or "").lower()
    pool = _resume_evidence_pool(parsed_resume)
    existing_tokens = _tokens(existing)

    matched_skills = [
        skill for skill in pool["skills"]
        if skill.lower() in question_text.lower() or skill.lower() in existing.lower()
    ]
    if matched_skills:
        return ", ".join(matched_skills[:3])

    for skill in pool["skills"]:
        if skill.lower() in question_text.lower():
            return skill

    for group in ["projects", "experience", "certifications", "education"]:
        for item in pool[group]:
            item_tokens = _tokens(item)
            if len(question_tokens.intersection(item_tokens)) >= 2:
                return item
            if existing and len(existing_tokens.intersection(item_tokens)) >= 2:
                return item

    if existing and not any(pool.values()):
        return existing
    if "project" in question_type and pool["projects"]:
        return pool["projects"][0]
    if any(term in question_type for term in ["technical", "backend", "software", "role"]):
        if pool["skills"]:
            return ", ".join(pool["skills"][:3])
        if pool["experience"]:
            return pool["experience"][0]
    return ""


def normalize_question(question: Dict[str, str], parsed_resume: Dict | None) -> Dict[str, str]:
    normalized = dict(question)
    normalized["question"] = str(normalized.get("question") or "").strip()
    normalized["type"] = str(normalized.get("type") or "Interview").strip() or "Interview"
    normalized["focus"] = str(normalized.get("focus") or "").strip()
    normalized["resumeEvidence"] = _infer_resume_evidence(normalized, parsed_resume)
    normalized["expectedSignals"] = normalized.get("expectedSignals") or normalized.get("expected_signals") or []
    normalized.pop("resume_evidence", None)
    normalized.pop("expected_signals", None)
    return normalized


# =========================================================================
#  DEEP TECHNICAL QUESTION TEMPLATES BY ROLE
# =========================================================================

PYTHON_QUESTIONS = [
    {"type": "Technical", "question": "Explain the difference between __init__ and __new__ in Python. When would you override __new__?", "focus": "OOP internals", "expectedSignals": ["metaclass awareness", "instance creation"]},
    {"type": "Technical", "question": "How does Python's GIL affect multithreading? What alternatives exist for CPU-bound parallel tasks?", "focus": "concurrency", "expectedSignals": ["GIL mechanism", "multiprocessing", "asyncio"]},
    {"type": "Technical", "question": "Walk me through Python's MRO. How does C3 linearization handle diamond inheritance?", "focus": "inheritance", "expectedSignals": ["C3 linearization", "super() chain"]},
    {"type": "Technical", "question": "Explain Python decorators with a concrete example. How would you write a retry decorator with exponential backoff?", "focus": "decorators", "expectedSignals": ["closure", "functools.wraps", "practical pattern"]},
    {"type": "Technical", "question": "Compare list comprehension, generator expression, and map/filter. When does memory efficiency matter?", "focus": "Pythonic patterns", "expectedSignals": ["lazy evaluation", "memory", "readability"]},
    {"type": "Technical", "question": "How does asyncio work in Python? How would you handle 10,000 concurrent HTTP requests?", "focus": "async programming", "expectedSignals": ["event loop", "coroutines", "aiohttp"]},
    {"type": "Technical", "question": "Explain context managers in Python. How would you build one that manages a database transaction with rollback?", "focus": "resource management", "expectedSignals": ["__enter__", "__exit__", "contextlib"]},
    {"type": "System Design", "question": "Design a task queue system in Python with retries, dead letter queue, and priority scheduling.", "focus": "system design", "expectedSignals": ["Celery", "Redis", "retry backoff"]},
]

JAVA_QUESTIONS = [
    {"type": "Technical", "question": "Explain the JVM memory model. What is the difference between stack and heap memory, and how does garbage collection work?", "focus": "JVM internals", "expectedSignals": ["heap generations", "GC algorithms", "stack frames"]},
    {"type": "Technical", "question": "What are the differences between HashMap, ConcurrentHashMap, and TreeMap? When would you choose each?", "focus": "collections", "expectedSignals": ["thread safety", "O(1) vs O(log n)", "ordering"]},
    {"type": "Technical", "question": "Explain Java's Stream API. How would you use parallel streams safely and when should you avoid them?", "focus": "functional programming", "expectedSignals": ["lazy evaluation", "ForkJoinPool", "thread safety"]},
    {"type": "Technical", "question": "What is the difference between checked and unchecked exceptions in Java? How do you design a clean exception hierarchy for a microservice?", "focus": "error handling", "expectedSignals": ["exception hierarchy", "custom exceptions", "error codes"]},
    {"type": "Technical", "question": "Explain Spring Boot's dependency injection. What is the difference between @Component, @Service, @Repository, and @Controller?", "focus": "Spring framework", "expectedSignals": ["IoC container", "bean lifecycle", "component scanning"]},
    {"type": "Technical", "question": "How does the synchronized keyword work in Java? Compare it with ReentrantLock and volatile.", "focus": "concurrency", "expectedSignals": ["monitor lock", "happens-before", "atomic operations"]},
    {"type": "Technical", "question": "Explain the SOLID principles with Java examples. Which principle do developers violate most often?", "focus": "design principles", "expectedSignals": ["SRP", "OCP", "real examples"]},
    {"type": "System Design", "question": "Design a RESTful microservice architecture for an e-commerce order system using Spring Boot. How do you handle distributed transactions?", "focus": "system design", "expectedSignals": ["saga pattern", "event sourcing", "API gateway"]},
]

MERN_QUESTIONS = [
    {"type": "Technical", "question": "Explain React's reconciliation algorithm. What is the fiber architecture and how does it improve rendering performance?", "focus": "React internals", "expectedSignals": ["fiber tree", "time slicing", "concurrent mode"]},
    {"type": "Technical", "question": "What are the rules of React hooks? Explain useEffect cleanup, stale closures, and how useRef avoids re-renders.", "focus": "React hooks", "expectedSignals": ["closure over state", "cleanup function", "ref vs state"]},
    {"type": "Technical", "question": "Explain the Node.js event loop phases. What happens when you mix setImmediate, process.nextTick, and setTimeout?", "focus": "Node.js runtime", "expectedSignals": ["poll phase", "microtask queue", "I/O callbacks"]},
    {"type": "Technical", "question": "How does MongoDB handle indexing? Explain compound indexes, covered queries, and when to use aggregation pipelines vs find.", "focus": "MongoDB", "expectedSignals": ["B-tree indexes", "explain plan", "pipeline stages"]},
    {"type": "Technical", "question": "Compare Express middleware pattern with Koa and Fastify. How does middleware ordering affect security?", "focus": "Express.js", "expectedSignals": ["middleware chain", "error middleware", "onion model"]},
    {"type": "Technical", "question": "How would you implement authentication in a MERN app? Compare JWT tokens vs sessions, and explain refresh token rotation.", "focus": "authentication", "expectedSignals": ["JWT structure", "httpOnly cookies", "token rotation"]},
    {"type": "Technical", "question": "Explain Server-Side Rendering vs Static Site Generation in Next.js. When would you use ISR?", "focus": "rendering strategies", "expectedSignals": ["getServerSideProps", "getStaticProps", "revalidation"]},
    {"type": "System Design", "question": "Design a real-time chat application using the MERN stack with typing indicators, read receipts, and message history.", "focus": "system design", "expectedSignals": ["Socket.IO", "MongoDB change streams", "message queue"]},
]

FRONTEND_QUESTIONS = [
    {"type": "Technical", "question": "Explain React's virtual DOM reconciliation. What causes unnecessary re-renders and how do you prevent them?", "focus": "React internals", "expectedSignals": ["fiber", "React.memo", "useMemo"]},
    {"type": "Technical", "question": "How would you implement code splitting and lazy loading in React? What metrics would you track?", "focus": "performance", "expectedSignals": ["React.lazy", "Suspense", "LCP"]},
    {"type": "Technical", "question": "Explain the browser event loop. How do microtasks differ from macrotasks?", "focus": "JavaScript runtime", "expectedSignals": ["call stack", "Promise vs setTimeout"]},
    {"type": "Technical", "question": "Compare React state management: Context API, Redux, Zustand. When would you pick each?", "focus": "state management", "expectedSignals": ["re-render scope", "middleware"]},
    {"type": "Technical", "question": "How do you implement accessibility in a complex dropdown with keyboard navigation and screen readers?", "focus": "accessibility", "expectedSignals": ["ARIA roles", "focus management"]},
    {"type": "Technical", "question": "Explain CSS specificity, the cascade, and how CSS-in-JS solutions like styled-components handle scoping.", "focus": "CSS architecture", "expectedSignals": ["specificity rules", "shadow DOM", "scoping"]},
    {"type": "System Design", "question": "Design a real-time collaborative editor for the browser. How do you handle conflicts?", "focus": "system design", "expectedSignals": ["CRDT or OT", "WebSocket"]},
]

BACKEND_QUESTIONS = [
    {"type": "Technical", "question": "Design a rate limiter for 10,000 requests per second. What algorithm and data store?", "focus": "rate limiting", "expectedSignals": ["token bucket", "Redis", "sliding window"]},
    {"type": "Technical", "question": "Explain CAP theorem. For payment processing, consistency or availability?", "focus": "distributed systems", "expectedSignals": ["partition tolerance", "trade-offs"]},
    {"type": "Technical", "question": "Design a multi-tenant database schema. Row-level isolation versus schema-per-tenant trade-offs?", "focus": "database architecture", "expectedSignals": ["RLS", "tenant_id", "migration"]},
    {"type": "Technical", "question": "How do you handle zero-downtime database migrations when renaming a column used by running code?", "focus": "deployment", "expectedSignals": ["expand-contract", "backward compatible"]},
    {"type": "Technical", "question": "Explain connection pooling. 50 concurrent requests but 10 DB connections — what happens?", "focus": "resource management", "expectedSignals": ["pool size", "queue depth"]},
    {"type": "Technical", "question": "Compare message brokers: RabbitMQ vs Kafka vs Redis Pub/Sub. When would you use each?", "focus": "messaging", "expectedSignals": ["ordering", "durability", "consumer groups"]},
    {"type": "System Design", "question": "Design a URL shortener handling 1 billion URLs. Data model, encoding, read/write paths.", "focus": "system design", "expectedSignals": ["base62", "cache layer"]},
]

SOFTWARE_DEV_QUESTIONS = [
    {"type": "Technical", "question": "Explain time and space complexity. Walk me through optimizing a function from O(n²) to O(n log n).", "focus": "algorithms", "expectedSignals": ["Big-O analysis", "sorting", "optimization"]},
    {"type": "Technical", "question": "What is the difference between a process and a thread? How does your OS schedule them?", "focus": "operating systems", "expectedSignals": ["context switching", "scheduling algorithms"]},
    {"type": "Technical", "question": "Explain Git internals: what is a commit object, how do branches work, and what happens during a rebase vs merge?", "focus": "version control", "expectedSignals": ["DAG", "SHA hash", "rebase risks"]},
    {"type": "Technical", "question": "How do you write testable code? Explain dependency injection, mocking, and when integration tests beat unit tests.", "focus": "testing", "expectedSignals": ["test pyramid", "mocking strategies", "TDD"]},
    {"type": "Technical", "question": "Explain REST vs GraphQL vs gRPC. For a mobile app with limited bandwidth, which would you choose and why?", "focus": "API design", "expectedSignals": ["over-fetching", "schema", "protobuf"]},
    {"type": "Technical", "question": "What is a deadlock? How would you detect and prevent one in a multi-threaded application?", "focus": "concurrency", "expectedSignals": ["resource ordering", "timeout", "detection graph"]},
    {"type": "System Design", "question": "Design a notification system that sends push, email, and SMS alerts with retry logic and user preferences.", "focus": "system design", "expectedSignals": ["fan-out", "priority queue", "delivery guarantee"]},
]

FULLSTACK_QUESTIONS = [
    {"type": "Technical", "question": "How do you decide what logic belongs on the frontend versus the backend?", "focus": "architecture boundary", "expectedSignals": ["validation", "security", "UX"]},
    {"type": "Technical", "question": "Explain the full journey of a browser request from URL bar to rendered page.", "focus": "web fundamentals", "expectedSignals": ["DNS", "TCP", "TLS", "rendering"]},
    {"type": "Technical", "question": "Compare WebSocket, SSE, and polling for real-time features. When would you use each?", "focus": "real-time", "expectedSignals": ["bidirectional", "server push", "scaling"]},
    {"type": "Technical", "question": "How do you implement end-to-end type safety from database to frontend UI?", "focus": "type safety", "expectedSignals": ["TypeScript", "Prisma", "tRPC", "Zod"]},
    {"type": "Technical", "question": "Explain optimistic UI updates. What happens when the server rejects the change?", "focus": "UX engineering", "expectedSignals": ["rollback", "conflict resolution"]},
]

ROLE_QUESTION_MAP = {
    "python": PYTHON_QUESTIONS,
    "django": PYTHON_QUESTIONS,
    "fastapi": PYTHON_QUESTIONS,
    "java": JAVA_QUESTIONS,
    "spring": JAVA_QUESTIONS,
    "kotlin": JAVA_QUESTIONS,
    "mern": MERN_QUESTIONS,
    "mean": MERN_QUESTIONS,
    "mongodb": MERN_QUESTIONS,
    "frontend": FRONTEND_QUESTIONS,
    "react": FRONTEND_QUESTIONS,
    "angular": FRONTEND_QUESTIONS,
    "vue": FRONTEND_QUESTIONS,
    "ui": FRONTEND_QUESTIONS,
    "backend": BACKEND_QUESTIONS,
    "api": BACKEND_QUESTIONS,
    "node": BACKEND_QUESTIONS,
    "express": BACKEND_QUESTIONS,
    "software": SOFTWARE_DEV_QUESTIONS,
    "developer": SOFTWARE_DEV_QUESTIONS,
    "engineer": SOFTWARE_DEV_QUESTIONS,
    "fullstack": FULLSTACK_QUESTIONS,
    "full stack": FULLSTACK_QUESTIONS,
    "full-stack": FULLSTACK_QUESTIONS,
}


def get_role_template_questions(job_role: str, limit: int = 6) -> List[Dict[str, str]]:
    role_lower = (job_role or "").lower()
    for key, questions in ROLE_QUESTION_MAP.items():
        if key in role_lower:
            return questions[:limit]
    return SOFTWARE_DEV_QUESTIONS[:limit]


# =========================================================================
#  RESUME PROJECT DEEP-DIVE QUESTIONS
# =========================================================================

def _extract_project_questions(parsed_resume: Dict | None, job_role: str) -> List[Dict[str, str]]:
    """Generate deep questions from actual resume projects."""
    parsed_resume = parsed_resume or {}
    projects = parsed_resume.get("projects", [])
    experience = parsed_resume.get("experience", [])
    skills = parsed_resume.get("skills", [])
    questions = []

    for project in projects[:3]:
        name = ""
        desc = ""
        if isinstance(project, dict):
            name = project.get("name") or project.get("title") or ""
            desc = project.get("description") or project.get("details") or str(project)
        elif isinstance(project, str):
            name = project[:60]
            desc = project

        if not name and not desc:
            continue

        proj_label = name if name else desc[:60]
        questions.append({
            "type": "Project",
            "question": f"Tell me about your project '{proj_label}'. What was the core architecture, what technical decisions did you make, and what was the measurable impact?",
            "focus": "project deep-dive",
            "resumeEvidence": proj_label,
            "expectedSignals": ["architecture", "technical decisions", "measurable impact", "ownership"],
        })
        questions.append({
            "type": "Project",
            "question": f"In '{proj_label}', what was the hardest technical challenge you faced and how did you solve it?",
            "focus": "problem solving",
            "resumeEvidence": proj_label,
            "expectedSignals": ["challenge identification", "approach", "solution", "learning"],
        })

    for exp in experience[:2]:
        if isinstance(exp, dict):
            company = exp.get("company") or exp.get("organization") or ""
            role_title = exp.get("title") or exp.get("role") or ""
            exp_label = f"{role_title} at {company}" if company and role_title else str(exp)[:80]
        elif isinstance(exp, str):
            exp_label = exp[:80]
        else:
            continue

        if not exp_label.strip():
            continue

        questions.append({
            "type": "Experience",
            "question": f"As {exp_label}, what was your most significant technical contribution and how did it impact the team or product?",
            "focus": "experience deep-dive",
            "resumeEvidence": exp_label,
            "expectedSignals": ["ownership", "technical contribution", "team impact"],
        })

    return questions


def basic_role_questions(job_role: str) -> List[Dict[str, str]]:
    role = (job_role or "Software Developer").lower()
    is_backend = any(term in role for term in ["backend", "back end", "api", "server"])
    is_software = any(term in role for term in ["software", "developer", "engineer", "full stack", "fullstack"])

    common = [
        {
            "type": "Basic",
            "question": "To begin, briefly introduce yourself and summarize the strongest technical experience from your resume.",
            "focus": "intro, clarity, resume summary",
            "expectedSignals": ["clear introduction", "technical focus", "role alignment"],
        },
        {
            "type": "Basic",
            "question": f"Why do you want to proceed with the {job_role or 'Software Developer'} role, and what makes you a good fit for it?",
            "focus": "role motivation",
            "expectedSignals": ["motivation", "role understanding", "evidence"],
        },
    ]

    if is_backend:
        common.append({
            "type": "Backend",
            "question": "Explain how you would design a reliable REST API for a production system. Include authentication, validation, and error handling.",
            "focus": "backend fundamentals",
            "expectedSignals": ["api design", "auth", "validation", "error handling"],
        })
    elif is_software:
        common.append({
            "type": "Software",
            "question": "How do you approach debugging when a feature works locally but fails in production?",
            "focus": "engineering process",
            "expectedSignals": ["logs", "reproduction", "hypothesis", "rollback"],
        })

    return common


def fallback_questions(job_role: str, parsed_resume: Dict | None = None) -> List[Dict[str, str]]:
    role = job_role or "this role"
    parsed_resume = parsed_resume or {}
    skills = _short_items(parsed_resume.get("skills", []), 6)
    projects = _short_items(parsed_resume.get("projects", []), 3)
    experience = _short_items(parsed_resume.get("experience", []), 3)
    strongest_skill = skills[0] if skills else "your strongest technical skill"
    project = projects[0] if projects else "one important project from your resume"

    return [
        *basic_role_questions(role),
        {"type": "Technical", "question": f"Your resume mentions {strongest_skill}. Explain a real situation where you used it and what result it produced.", "resumeEvidence": strongest_skill, "expectedSignals": ["technical depth", "specific example", "impact"]},
        {"type": "Project", "question": f"Walk me through this resume project: {project}. What did you build, what was your contribution, and what tradeoff did you make?", "resumeEvidence": project, "expectedSignals": ["architecture", "ownership", "tradeoff"]},
        {"type": "Technical", "question": "How would you debug a production issue when users report the application is slow but logs are unclear?", "expectedSignals": ["structured debugging", "metrics", "root cause analysis"]},
        {"type": "Project", "question": f"Looking at {project}, what would you improve if you had one more week?", "resumeEvidence": project, "expectedSignals": ["reflection", "prioritization", "engineering judgment"]},
        {"type": "HR", "question": "Describe a time you handled feedback or pressure. What changed in your work after that?", "expectedSignals": ["self-awareness", "learning", "professional maturity"]},
        {"type": "Role", "question": f"If selected for {role}, what would you learn or ship in your first 30 days?", "expectedSignals": ["planning", "curiosity", "business awareness"]},
    ]


def _question_key(item: Dict[str, str]) -> str:
    return str(item.get("question") or "").strip().lower()


def enforce_question_plan(
    generated_questions: List[Dict[str, str]],
    job_role: str,
    parsed_resume: Dict | None,
    question_count: int,
) -> List[Dict[str, str]]:
    planned: List[Dict[str, str]] = []
    seen = set()

    def _add(q):
        key = _question_key(q)
        if key and key not in seen:
            planned.append(q)
            seen.add(key)

    # 1. Groq-generated resume/job questions are the primary interview plan.
    for q in generated_questions:
        if not isinstance(q, dict):
            continue
        q = normalize_question(q, parsed_resume)
        _add(q)
        if len(planned) >= question_count:
            return planned[:question_count]

    # 2. Emergency fallback only if Groq returns too few valid questions.
    for q in fallback_questions(job_role, parsed_resume):
        q = normalize_question(q, parsed_resume)
        _add(q)
        if len(planned) >= question_count:
            break

    return planned[:question_count]


def generate_questions(
    parsed_resume: Dict,
    job_role: str,
    job_description: str,
    ats_score: Dict | None,
    question_count: int = 10,
) -> Dict:
    fallback = {"questions": fallback_questions(job_role, parsed_resume)[:question_count]}
    retrieved_context = retrieve_context(f"{job_role}\n{job_description}", limit=5)

    candidate_name = str((parsed_resume or {}).get("name", "")).strip()
    name_prefix = f"Address the candidate as {candidate_name}. " if candidate_name else ""

    # Extract resume projects for the prompt
    projects_text = ""
    for p in (parsed_resume or {}).get("projects", [])[:4]:
        if isinstance(p, dict):
            projects_text += f"- {p.get('name', '')}: {p.get('description', '')}\n"
        elif isinstance(p, str):
            projects_text += f"- {p}\n"

    prompt = f"""
You are Sarah, a friendly but deeply technical senior engineering manager conducting a voice interview.
{name_prefix}Create {question_count} interview questions. Return only valid JSON:
{{"questions":[{{"type":"HR|Technical|Project|Role|System Design|Debugging","question":"...","focus":"...","resumeEvidence":"...","expectedSignals":["..."]}}]}}

CRITICAL REQUIREMENTS:
- First 2 questions: warm-up (self-intro, role motivation).
- At least 3 questions MUST reference specific projects from the resume below.
- At least 3 questions must be deeply technical for the role "{job_role}".
- Include 1 system design question and 1 debugging/troubleshooting scenario.
- Every technical question must ask for evidence, tradeoffs, or measurable impact.
- Use a warm, conversational, professional female recruiter tone.
- Keep each question under 40 words for natural voice delivery.
- Do NOT invent resume facts.

Resume projects:
{projects_text}

Job role: {job_role}
Job description: {job_description[:3000]}
Parsed resume: {json.dumps(parsed_resume, ensure_ascii=False)[:4000]}
ATS score: {json.dumps(ats_score or {}, ensure_ascii=False)[:1500]}
Context: {json.dumps(retrieved_context, ensure_ascii=False)[:3000]}
"""
    result = chat_json(
        "You are Sarah, a senior engineering manager. Create practical, deeply technical interview questions. Return strict JSON only.",
        prompt,
        fallback,
    )
    if isinstance(result, list):
        result = {"questions": result}
    if not isinstance(result, dict) or not isinstance(result.get("questions"), list):
        return fallback
    return {
        "questions": enforce_question_plan(
            result["questions"],
            job_role,
            parsed_resume,
            question_count,
        )
    }

