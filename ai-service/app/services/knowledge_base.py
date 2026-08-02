import json
from pathlib import Path
from typing import Dict, List

import numpy as np

from app.services.ats import embedding_model


ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = ROOT / "data" / "knowledge_base" / "index.json"


def retrieve_context(query: str, limit: int = 5) -> List[Dict]:
    if not INDEX_PATH.exists() or not query.strip():
        return []

    try:
        index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        items = index.get("items", [])
        if not items:
            return []

        model = embedding_model()
        query_vector = model.encode([query], normalize_embeddings=True)[0]
        scored = []

        for item in items:
            vector = np.array(item.get("embedding", []), dtype=np.float32)
            if vector.size == 0:
                continue
            score = float(np.dot(query_vector, vector))
            scored.append((score, item))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [
            {
                "score": round(score, 4),
                "source": item.get("source", "local-dataset"),
                "text": item.get("text", "")[:1200],
            }
            for score, item in scored[:limit]
        ]
    except Exception:
        return []

