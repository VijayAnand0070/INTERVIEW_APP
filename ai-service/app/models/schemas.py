from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ATSScoreRequest(CamelModel):
    parsed_resume: Dict[str, Any] = Field(default_factory=dict, alias="parsedResume")
    job_role: str = Field("", alias="jobRole")
    job_description: str = Field("", alias="jobDescription")


class GenerateQuestionsRequest(CamelModel):
    parsed_resume: Dict[str, Any] = Field(default_factory=dict, alias="parsedResume")
    job_role: str = Field("", alias="jobRole")
    job_description: str = Field("", alias="jobDescription")
    ats_score: Optional[Dict[str, Any]] = Field(default=None, alias="atsScore")
    question_count: int = Field(8, alias="questionCount")


class EvaluateAnswerRequest(CamelModel):
    question: Any
    answer: str = ""
    job_role: str = Field("", alias="jobRole")
    job_description: str = Field("", alias="jobDescription")
    parsed_resume: Dict[str, Any] = Field(default_factory=dict, alias="parsedResume")
    ats_score: Optional[Dict[str, Any]] = Field(default=None, alias="atsScore")
    rubric: List[str] = Field(default_factory=list)


class TextToSpeechRequest(BaseModel):
    text: str
    voice: str = "female_recruiter"


class FinalReportRequest(CamelModel):
    candidate_name: str = Field("Candidate", alias="candidateName")
    job_role: str = Field("", alias="jobRole")
    parsed_resume: Dict[str, Any] = Field(default_factory=dict, alias="parsedResume")
    ats_score: Optional[Dict[str, Any]] = Field(default=None, alias="atsScore")
    answers: List[Dict[str, Any]] = Field(default_factory=list)
