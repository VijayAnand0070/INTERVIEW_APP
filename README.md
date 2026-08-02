# Pucca Interview App

Production-ready V1 scaffold for an AI interview preparation platform:

Resume Upload -> ATS Score -> Voice Interview -> Final Report

## Stack

- Frontend: React, Vite, React Router, Axios, Tailwind CSS, Supabase Auth
- Backend: Node.js, Express, Multer, Supabase JS
- AI Service: Python FastAPI, PyMuPDF, spaCy, sentence-transformers, faster-whisper, Ollama
- Database and Storage: Supabase PostgreSQL and Supabase Storage

## Project Layout

```text
pucca-interview-app/
  client/
  server/
  ai-service/
  supabase/
  README.md
```

## Supabase Setup

1. Open the Supabase SQL Editor.
2. Run `supabase/schema.sql`, then `supabase/migration_v2.sql`.
3. Confirm these Storage buckets exist:
   - `resumes`
   - `user-audio`
   - `tts-audio`
   - `reports`

Keep the service role key server-side only. Never put it in the Vite client env.

## Environment Files

Create `client/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
VITE_API_URL=http://localhost:5000
```

Create `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AI_SERVICE_URL=http://localhost:8000
```

Create `ai-service/.env`:

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b-instruct-q4_K_M
WHISPER_MODEL=base
TTS_PROVIDER=piper
PIPER_BINARY=piper
PIPER_VOICE_PATH=./voices/en_US-lessac-medium.onnx
```

## API Keys Needed

This V1 does not need paid AI API keys.

- Required: Supabase project URL.
- Required: Supabase anon or publishable key for `client/.env`.
- Required: Supabase service role key for `server/.env` only.
- Optional: Hugging Face token only if you choose gated/private datasets or models.
- Not required: OpenAI, Anthropic, Google, or any paid LLM key.

Do not place the Supabase service role key in the frontend.

## Local AI Setup

Install Ollama and pull a quantized Qwen model:

```bash
ollama pull qwen2.5:3b-instruct-q4_K_M
```

For best local text-to-speech, use Coqui XTTS-v2 with a clean female reference voice. XTTS-v2 supports voice cloning from a short clip and can produce natural 24 kHz speech. If XTTS is not configured, the app falls back to Piper, then browser speech synthesis.

Coqui XTTS-v2 setup:

```bash
cd ai-service
py -3.11 -m venv .venv-xtts
.venv-xtts\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-xtts.txt
```

Then review the Coqui Public Model License and set:

```env
TTS_PROVIDER=xtts
COQUI_TOS_AGREED=1
XTTS_SPEAKER_WAV=./voices/female_recruiter.wav
XTTS_LANGUAGE=en
XTTS_USE_GPU=auto
```

Place a permitted female reference clip at `ai-service/voices/female_recruiter.wav`. If no reference clip is present, the app tries the built-in `Ana Florence` speaker.

## Dataset-Based Improvement

Do not fine-tune the quantized Ollama Q4 model directly for V1. Use retrieval instead:

1. Add local interview datasets to `ai-service/data/datasets` as `.txt`, `.md`, or `.jsonl`.
2. Run:

```bash
cd ai-service
python scripts/build_knowledge_base.py
```

The question generator retrieves relevant examples from `data/knowledge_base/index.json` and includes them as local context for Qwen.

## Run Locally

In three terminals:

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## API Surface

Backend:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/resume/upload`
- `POST /api/ats/score`
- `POST /api/interview/start`
- `POST /api/interview/answer`
- `POST /api/interview/text-answer`
- `GET /api/interview/result/:id`

AI service:

- `POST /parse-resume`
- `POST /ats-score`
- `POST /generate-questions`
- `POST /speech-to-text`
- `POST /evaluate-answer`
- `POST /text-to-speech`
- `POST /final-report`

## Notes For RTX 3050 6GB

- Use `qwen2.5:3b-instruct-q4_K_M` or another Q4 3B-class model in Ollama.
- Use `WHISPER_MODEL=base` first; move to `small` only if latency is acceptable.
- Keep question count modest for V1, currently 8 by default.
