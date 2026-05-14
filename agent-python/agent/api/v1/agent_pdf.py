"""PDF Agent 路由。"""

from fastapi import APIRouter, Depends

from agent.core.security import verify_internal_token
from agent.schemas.common import ApiResponse, success_response
from agent.schemas.pdf import (
    EvidenceChunk,
    PdfQaData,
    PdfQaRequest,
    PdfSummaryData,
    PdfSummaryRequest,
)
from agent.services.agent_service import AgentService
from agent.services.factory import get_agent_service, get_pdf_service
from agent.services.pdf_service import PdfService

router = APIRouter(
    prefix="/agent",
    tags=["PDF Agent"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/pdf-summary", response_model=ApiResponse[PdfSummaryData], summary="PDF 摘要")
def pdf_summary(
    request: PdfSummaryRequest,
    pdf_service: PdfService = Depends(get_pdf_service),
    agent_service: AgentService = Depends(get_agent_service),
) -> ApiResponse[PdfSummaryData]:
    """提取 PDF 文本并返回结构化摘要。"""

    parsed = pdf_service.parse_pdf_from_storage(
        bucket=request.bucket,
        object_key=request.object_key,
    )
    result = agent_service.generate_summary(
        document_text=parsed.cleaned_text,
        chunks=parsed.chunks,
    )

    data = PdfSummaryData(
        summary=result.summary,
        key_points=result.key_points,
        risk_points=result.risk_points,
        suggested_questions=result.suggested_questions,
    )
    return success_response(data=data)


@router.post("/pdf-qa", response_model=ApiResponse[PdfQaData], summary="PDF 问答")
def pdf_qa(
    request: PdfQaRequest,
    pdf_service: PdfService = Depends(get_pdf_service),
    agent_service: AgentService = Depends(get_agent_service),
) -> ApiResponse[PdfQaData]:
    """基于 PDF 文本上下文进行问答。"""

    parsed = pdf_service.parse_pdf_from_storage(
        bucket=request.bucket,
        object_key=request.object_key,
    )
    result = agent_service.answer_question(
        document_text=parsed.cleaned_text,
        question=request.question,
        chunks=parsed.chunks,
    )

    data = PdfQaData(
        answer=result.answer,
        confidence=result.confidence,
        evidence_chunks=[EvidenceChunk(**chunk) for chunk in result.evidence_chunks],
    )
    return success_response(data=data)
