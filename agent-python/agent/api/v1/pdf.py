"""PDF 解析路由。"""

from fastapi import APIRouter, Depends

from agent.core.security import verify_internal_token
from agent.schemas.common import ApiResponse, success_response
from agent.schemas.pdf import ChunkItem, PdfParseData, PdfParseRequest
from agent.services.factory import get_pdf_service
from agent.services.pdf_service import PdfService

router = APIRouter(
    prefix="/pdf",
    tags=["PDF"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/parse", response_model=ApiResponse[PdfParseData], summary="解析 PDF")
def parse_pdf(
    request: PdfParseRequest,
    pdf_service: PdfService = Depends(get_pdf_service),
) -> ApiResponse[PdfParseData]:
    """根据 bucket/objectKey 下载并解析 PDF。"""

    parsed = pdf_service.parse_pdf_from_storage(
        bucket=request.bucket,
        object_key=request.object_key,
    )

    data = PdfParseData(
        file_id=request.file_id,
        page_count=parsed.page_count,
        text_length=len(parsed.cleaned_text),
        chunks=[ChunkItem(**chunk) for chunk in parsed.chunks],
        preview=parsed.cleaned_text[:300],
    )
    return success_response(data=data)
