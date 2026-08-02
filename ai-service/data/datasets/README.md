# Local Interview Dataset Folder

Put local `.txt`, `.md`, or `.jsonl` interview-prep datasets here.

For `.jsonl`, each line can use:

```json
{"question":"Explain React reconciliation.","answer":"A strong answer..."}
```

Then run:

```bash
python scripts/build_knowledge_base.py
```

This creates `data/knowledge_base/index.json`, which the question generator can use as retrieval context. This is the recommended V1 path instead of fine-tuning a quantized Ollama model.

