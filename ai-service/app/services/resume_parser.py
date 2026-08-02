from pathlib import Path
from typing import Dict, List

from functools import lru_cache
import re


SKILL_BANK = {
    "agile",
    "api design",
    "asp.net",
    "python",
    "javascript",
    "typescript",
    "java",
    "c++",
    "c#",
    "go",
    "rust",
    "react",
    "redux",
    "next.js",
    "vue",
    "angular",
    "node.js",
    "express",
    "fastapi",
    "django",
    "flask",
    "sql",
    "postgresql",
    "mongodb",
    "supabase",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "git",
    "github",
    "gitlab",
    "linux",
    "html",
    "css",
    "tailwind",
    "bootstrap",
    "machine learning",
    "deep learning",
    "nlp",
    "llm",
    "ollama",
    "rest api",
    "graphql",
    "microservices",
    "system design",
    "redis",
    "rabbitmq",
    "kafka",
    "jwt",
    "oauth",
    "unit testing",
    "testing",
    "jest",
    "pytest",
    "ci/cd",
    "data structures",
    "algorithms",
}

SKILL_ALIASES = {
    "node": "node.js",
    "nodejs": "node.js",
    "react.js": "react",
    "reactjs": "react",
    "nextjs": "next.js",
    "postgres": "postgresql",
    "postgre": "postgresql",
    "rest": "rest api",
    "apis": "api design",
    "ml": "machine learning",
    "gen ai": "llm",
    "generative ai": "llm",
}

SECTION_HEADINGS = {
    "summary": ["summary", "profile", "objective", "about"],
    "skills": ["skills", "technical skills", "technologies", "tools"],
    "education": ["education", "academic", "academics"],
    "experience": ["experience", "work experience", "professional experience", "employment"],
    "projects": ["projects", "project work", "academic projects"],
    "certifications": ["certifications", "certificates", "licenses"],
}

@lru_cache(maxsize=1)
def nlp():
    import spacy

    try:
        return spacy.load("en_core_web_sm")
    except Exception:
        return spacy.blank("en")


def extract_text(file_path: str, filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        import fitz

        with fitz.open(file_path) as doc:
            return "\n".join(page.get_text("text") for page in doc)

    if suffix == ".docx":
        from docx import Document

        document = Document(file_path)
        return "\n".join(paragraph.text for paragraph in document.paragraphs)

    raise ValueError("Unsupported resume format")


def _first_match(pattern: str, text: str) -> str:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return match.group(0).strip() if match else ""


def _lines_matching(text: str, keywords: List[str], limit: int = 8) -> List[str]:
    lines = [line.strip(" -:\t") for line in text.splitlines() if line.strip()]
    matches = [
        line for line in lines
        if any(keyword.lower() in line.lower() for keyword in keywords)
    ]
    return list(dict.fromkeys(matches))[:limit]


def _clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip(" -•:\t")).strip()


def _normalized_lines(text: str) -> List[str]:
    return [_clean_line(line) for line in text.splitlines() if _clean_line(line)]


def extract_sections(text: str) -> Dict[str, List[str]]:
    lines = _normalized_lines(text)
    heading_to_section = {
        heading.lower(): section
        for section, headings in SECTION_HEADINGS.items()
        for heading in headings
    }
    sections: Dict[str, List[str]] = {key: [] for key in SECTION_HEADINGS}
    current = ""

    for line in lines:
        normalized = re.sub(r"[^a-zA-Z ]", "", line).strip().lower()
        if normalized in heading_to_section:
            current = heading_to_section[normalized]
            continue

        if current:
            sections[current].append(line)

    return {key: value[:12] for key, value in sections.items() if value}


def extract_name(text: str) -> str:
    lines = _normalized_lines(text)
    contact_pattern = re.compile(r"@|\+?\d[\d\s().-]{8,}|linkedin|github|portfolio", re.I)
    for line in lines[:8]:
        if contact_pattern.search(line):
            continue
        words = line.split()
        if 1 < len(words) <= 4 and all(re.match(r"^[A-Za-z][A-Za-z.'-]*$", word) for word in words):
            return line[:80]

    doc = nlp()(text[:1200])
    for entity in getattr(doc, "ents", []):
        if entity.label_ == "PERSON" and len(entity.text.split()) <= 4:
            return entity.text.strip()

    for line in lines:
        clean = line.strip()
        if clean and not contact_pattern.search(clean):
            return clean[:80]
    return ""


def extract_skills(text: str) -> List[str]:
    lower_text = text.lower()
    skills = set()
    for skill in SKILL_BANK:
        pattern = r"(?<![a-z0-9+#.])" + re.escape(skill.lower()) + r"(?![a-z0-9+#.])"
        if re.search(pattern, lower_text):
            skills.add(skill)
    for alias, canonical in SKILL_ALIASES.items():
        pattern = r"(?<![a-z0-9+#.])" + re.escape(alias.lower()) + r"(?![a-z0-9+#.])"
        if re.search(pattern, lower_text):
            skills.add(canonical)
    return sorted(skills)


def _section_or_matches(sections: Dict[str, List[str]], key: str, text: str, keywords: List[str], limit: int = 8) -> List[str]:
    section_lines = sections.get(key, [])
    if section_lines:
        return section_lines[:limit]
    return _lines_matching(text, keywords, limit=limit)


def extract_links(text: str) -> List[str]:
    links = re.findall(r"https?://[^\s)]+|(?:github|linkedin)\.com/[^\s)]+", text, flags=re.I)
    return list(dict.fromkeys(link.strip(".,") for link in links))[:8]


def parse_resume(file_path: str, filename: str) -> Dict:
    text = extract_text(file_path, filename)
    sections = extract_sections(text)
    email = _first_match(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text)
    phone = _first_match(r"(\+?\d[\d\s().-]{8,}\d)", text)

    education = _section_or_matches(
        sections,
        "education",
        text,
        ["bachelor", "master", "b.tech", "m.tech", "degree", "university", "college"],
    )
    experience = _section_or_matches(
        sections,
        "experience",
        text,
        ["experience", "developer", "engineer", "intern", "worked", "built", "led", "company"],
    )
    projects = _section_or_matches(
        sections,
        "projects",
        text,
        ["project", "application", "platform", "system", "dashboard", "api", "prediction", "model"],
    )
    certifications = _section_or_matches(
        sections,
        "certifications",
        text,
        ["certified", "certification", "certificate", "aws", "azure", "google cloud"],
    )
    skills = extract_skills("\n".join(sections.get("skills", [])) or text)

    return {
        "name": extract_name(text),
        "email": email,
        "phone": phone,
        "links": extract_links(text),
        "summary": sections.get("summary", [])[:4],
        "skills": skills,
        "education": education,
        "experience": experience,
        "projects": projects,
        "certifications": certifications,
        "sections": sections,
        "raw_text": text[:30000],
        "word_count": len(re.findall(r"\w+", text)),
    }
