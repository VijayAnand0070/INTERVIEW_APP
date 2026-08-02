import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.models.schemas import (
    ATSScoreRequest,
    EvaluateAnswerRequest,
    FinalReportRequest,
    GenerateQuestionsRequest,
    TextToSpeechRequest,
)
from app.services.ats import calculate_ats_score
from app.services.evaluator import evaluate_answer
from app.services.llm import llm_readiness
from app.services.questions import generate_questions
from app.services.report import generate_final_report
from app.services.resume_parser import parse_resume
from app.services.stt import stt_readiness, transcribe_audio
from app.services.tts import synthesize, tts_readiness

app = FastAPI(title="interview_agent AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def save_upload(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        return tmp.name


def cleanup(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


@app.get("/health")
def health():
    return {"status": "ok", "service": "interview_agent-ai"}


@app.get("/readiness")
def readiness():
    tts = tts_readiness()
    llm = llm_readiness()
    stt = stt_readiness(load_model=False)

    return {
        "ready": bool(llm.get("ready") and stt.get("ready")),
        "llm": llm,
        "speech_to_text": stt,
        "text_to_speech": tts,
        "natural_voice_ready": bool(tts["xtts"]["ready"] or tts["piper"]["ready"]),
    }


@app.get("/models")
def models():
    return {
        "llm": llm_readiness(),
        "text_to_speech": tts_readiness(),
        "speech_to_text": stt_readiness(load_model=False),
    }


@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    tmp_path = await save_upload(file)
    try:
        return parse_resume(tmp_path, file.filename or "resume.pdf")
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    finally:
        cleanup(tmp_path)


@app.post("/ats-score")
def ats_score_endpoint(payload: ATSScoreRequest):
    return calculate_ats_score(
        parsed_resume=payload.parsed_resume,
        job_role=payload.job_role,
        job_description=payload.job_description,
    )


@app.post("/generate-questions")
def generate_questions_endpoint(payload: GenerateQuestionsRequest):
    return generate_questions(
        parsed_resume=payload.parsed_resume,
        job_role=payload.job_role,
        job_description=payload.job_description,
        ats_score=payload.ats_score,
        question_count=payload.question_count,
    )


@app.post("/speech-to-text")
async def speech_to_text_endpoint(audio: UploadFile = File(...)):
    tmp_path = await save_upload(audio)
    try:
        return transcribe_audio(tmp_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        cleanup(tmp_path)


@app.post("/evaluate-answer")
def evaluate_answer_endpoint(payload: EvaluateAnswerRequest):
    return evaluate_answer(
        question=payload.question,
        answer=payload.answer,
        job_role=payload.job_role,
        rubric=payload.rubric,
        job_description=payload.job_description,
        parsed_resume=payload.parsed_resume,
        ats_score=payload.ats_score,
    )


@app.post("/text-to-speech")
def text_to_speech_endpoint(payload: TextToSpeechRequest):
    return synthesize(payload.text, payload.voice)


@app.post("/final-report")
def final_report_endpoint(payload: FinalReportRequest):
    return generate_final_report(
        candidate_name=payload.candidate_name,
        job_role=payload.job_role,
        parsed_resume=payload.parsed_resume,
        ats_score=payload.ats_score,
        answers=payload.answers,
    )
