"""PDF 解析与 Agent 对接模型。"""

from pydantic import Field

from .common import CamelModel


class PdfParseRequest(CamelModel):
    """PDF 解析请求。"""

    user_id: int = Field(..., alias="userId", gt=0)
    file_id: str = Field(..., alias="fileId", min_length=1)
    bucket: str = Field(..., min_length=1)
    object_key: str = Field(..., alias="objectKey", min_length=1)
    file_name: str | None = Field(default=None, alias="fileName")
    biz_type: str | None = Field(default=None, alias="bizType")


class PdfSummaryRequest(PdfParseRequest):
    """PDF 摘要请求。"""


class PdfQaRequest(CamelModel):
    """PDF 问答请求。"""

    user_id: int = Field(..., alias="userId", gt=0)
    file_id: str = Field(..., alias="fileId", min_length=1)
    bucket: str = Field(..., min_length=1)
    object_key: str = Field(..., alias="objectKey", min_length=1)
    question: str = Field(..., min_length=1, max_length=2000)


class ChunkItem(CamelModel):
    """文本切片。"""

    index: int = Field(..., ge=0)
    length: int = Field(..., ge=0)
    content: str = Field(...)


class PdfParseData(CamelModel):
    """PDF 解析结果。"""

    file_id: str = Field(..., alias="fileId")
    page_count: int = Field(..., alias="pageCount", ge=0)
    text_length: int = Field(..., alias="textLength", ge=0)
    chunks: list[ChunkItem] = Field(default_factory=list)
    preview: str = Field(default="")


class PdfSummaryData(CamelModel):
    """PDF 摘要结果。"""

    summary: str = Field(default="")
    key_points: list[str] = Field(default_factory=list, alias="keyPoints")
    risk_points: list[str] = Field(default_factory=list, alias="riskPoints")
    suggested_questions: list[str] = Field(default_factory=list, alias="suggestedQuestions")


class EvidenceChunk(CamelModel):
    """问答证据切片。"""

    index: int = Field(..., ge=0)
    content: str = Field(...)


class PdfQaData(CamelModel):
    """PDF 问答结果。"""

    answer: str = Field(...)
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence_chunks: list[EvidenceChunk] = Field(default_factory=list, alias="evidenceChunks")


class HealthData(CamelModel):
    """健康检查数据。"""

    status: str = Field(default="ok")
    timestamp: str = Field(...)
