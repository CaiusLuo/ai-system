"""PDF 解析服务。"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from agent.core.config import settings
from agent.core.exceptions import PdfParseError
from agent.services.storage_service import MinioStorageService
from agent.utils.chunking import chunk_text
from agent.utils.text_cleaner import clean_text

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ParsedPdfDocument:
    """PDF 文档解析结果。"""

    page_count: int
    raw_text: str
    cleaned_text: str
    pages: list[str]
    chunks: list[dict]


class PdfService:
    """PDF 下载、解析、切片服务。"""

    def __init__(self, storage_service: MinioStorageService):
        self._storage_service = storage_service

    def parse_pdf_from_storage(self, bucket: str, object_key: str) -> ParsedPdfDocument:
        """从 MinIO 下载并解析 PDF。"""

        pdf_bytes = self._storage_service.download_object_bytes(bucket=bucket, object_key=object_key)
        return self.parse_pdf_bytes(pdf_bytes)

    def parse_pdf_bytes(self, pdf_bytes: bytes) -> ParsedPdfDocument:
        """解析 PDF 字节内容并进行基础文本清洗、切片。"""

        if not pdf_bytes:
            raise PdfParseError(message="pdf parse failed", detail={"reason": "empty file bytes"})

        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            raw_pages: list[str] = []
            cleaned_pages: list[str] = []

            for page in reader.pages:
                page_text = page.extract_text() or ""
                raw_pages.append(page_text)
                cleaned_pages.append(clean_text(page_text))

            raw_text = "\n\n".join(raw_pages).strip()
            cleaned_text = clean_text("\n\n".join(cleaned_pages))

            chunk_size, chunk_overlap = settings.get_pdf_chunk_config()
            chunks = chunk_text(
                text=cleaned_text,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )

            logger.info(
                "Parsed PDF successfully: pages=%s text_length=%s chunks=%s",
                len(reader.pages),
                len(cleaned_text),
                len(chunks),
            )

            return ParsedPdfDocument(
                page_count=len(reader.pages),
                raw_text=raw_text,
                cleaned_text=cleaned_text,
                pages=cleaned_pages,
                chunks=chunks,
            )

        except PdfReadError as exc:
            raise PdfParseError(
                message="pdf parse failed",
                detail={"reason": "invalid pdf", "error": str(exc)},
            ) from exc

        except PdfParseError:
            raise

        except Exception as exc:  # noqa: BLE001
            raise PdfParseError(
                message="pdf parse failed",
                detail={"reason": "unknown", "error": str(exc)},
            ) from exc
