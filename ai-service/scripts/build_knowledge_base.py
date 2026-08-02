import json
import re
from pathlib import Path

from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]
DATASET_DIR = ROOT / "data" / "datasets"
OUTPUT_DIR = ROOT / "data" / "knowledge_base"
OUTPUT_PATH = OUTPUT_DIR / "index.json"


def chunk_text(text: str, max_words: int = 180) -> list[str]:
    words = re.findall(r"\S+", text)
    chunks = []
    for start in range(0, len(words), max_words):
        chunk = " ".join(words[start:start + max_words]).strip()
        if len(chunk) > 80:
            chunks.append(chunk)
    return chunks


def read_jsonl(path: Path) -> list[str]:
    chunks = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        text = item.get("text") or item.get("question") or item.get("answer") or ""
        if item.get("question") and item.get("answer"):
            text = f"Question: {item['question']}\nStrong answer: {item['answer']}"
        chunks.extend(chunk_text(str(text)))
    return chunks


def load_dataset_chunks() -> list[dict]:
    items = []
    for path in DATASET_DIR.rglob("*"):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.suffix.lower() == ".jsonl":
            chunks = read_jsonl(path)
        elif path.suffix.lower() in {".txt", ".md"}:
            chunks = chunk_text(path.read_text(encoding="utf-8", errors="ignore"))
        else:
            continue
        items.extend({"source": str(path.relative_to(DATASET_DIR)), "text": chunk} for chunk in chunks)
    return items


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    items = load_dataset_chunks()
    if not items:
        OUTPUT_PATH.write_text(json.dumps({"items": []}, indent=2), encoding="utf-8")
        print(f"No dataset chunks found. Add .txt, .md, or .jsonl files to {DATASET_DIR}.")
        return

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embeddings = model.encode([item["text"] for item in items], normalize_embeddings=True)
    for item, embedding in zip(items, embeddings):
        item["embedding"] = embedding.tolist()

    OUTPUT_PATH.write_text(json.dumps({"items": items}, indent=2), encoding="utf-8")
    print(f"Wrote {len(items)} chunks to {OUTPUT_PATH}.")


if __name__ == "__main__":
    main()

