"""Agent 服务（MVP 版本）。"""

from __future__ import annotations

import re
from dataclasses import dataclass

from agent.core.exceptions import AgentProcessError


@dataclass(slots=True)
class PdfSummaryResult:
    """摘要模式结果。"""

    summary: str
    key_points: list[str]
    risk_points: list[str]
    suggested_questions: list[str]


@dataclass(slots=True)
class PdfQaResult:
    """问答模式结果。"""

    answer: str
    evidence_chunks: list[dict]
    confidence: float


class AgentService:
    """预留可替换 LLM 的 Agent 服务。"""

    def generate_summary(self, document_text: str, chunks: list[dict]) -> PdfSummaryResult:
        """基于文档文本生成结构化摘要。"""

        try:
            normalized = (document_text or "").strip()
            if not normalized:
                return PdfSummaryResult(
                    summary="文档中未提取到有效文本，无法生成摘要。",
                    key_points=[],
                    risk_points=[],
                    suggested_questions=[
                        "请确认上传的 PDF 是否为可复制文本格式？",
                        "是否需要改用 OCR 方式进行识别？",
                    ],
                )

            sentences = self._split_sentences(normalized)
            key_points = [s for s in sentences if len(s) >= 12][:5]
            summary = self.mock_llm_call(
                mode="summary",
                question="",
                context_chunks=chunks,
                fallback_text=normalized,
            )

            risk_points = self._extract_risk_points(sentences)
            suggested_questions = self._build_suggested_questions(key_points)

            return PdfSummaryResult(
                summary=summary,
                key_points=key_points,
                risk_points=risk_points,
                suggested_questions=suggested_questions,
            )

        except Exception as exc:  # noqa: BLE001
            raise AgentProcessError(
                message="agent process failed",
                detail={"mode": "summary", "error": str(exc)},
            ) from exc

    def answer_question(self, document_text: str, question: str, chunks: list[dict]) -> PdfQaResult:
        """基于 PDF 文本进行问答。"""

        try:
            normalized_question = question.strip()
            if not normalized_question:
                return PdfQaResult(
                    answer="问题为空，请提供有效问题。",
                    evidence_chunks=[],
                    confidence=0.0,
                )

            if not (document_text or "").strip():
                return PdfQaResult(
                    answer="文档中未找到足够依据。",
                    evidence_chunks=[],
                    confidence=0.0,
                )

            top_matches = self._retrieve_top_chunks(normalized_question, chunks)
            if not top_matches:
                return PdfQaResult(
                    answer="文档中未找到足够依据。",
                    evidence_chunks=[],
                    confidence=0.2,
                )

            evidence_chunks = [
                {
                    "index": chunk["index"],
                    "content": chunk["content"][:300],
                }
                for chunk, _score in top_matches
            ]

            answer = self.mock_llm_call(
                mode="qa",
                question=normalized_question,
                context_chunks=[item[0] for item in top_matches],
                fallback_text=document_text,
            )
            confidence = self._calculate_confidence(top_matches)

            return PdfQaResult(
                answer=answer,
                evidence_chunks=evidence_chunks,
                confidence=confidence,
            )

        except AgentProcessError:
            raise

        except Exception as exc:  # noqa: BLE001
            raise AgentProcessError(
                message="agent process failed",
                detail={"mode": "qa", "error": str(exc)},
            ) from exc

    def mock_llm_call(
        self,
        mode: str,
        question: str,
        context_chunks: list[dict],
        fallback_text: str,
    ) -> str:
        """Mock LLM 调用，占位后续 LangChain/LangGraph/外部模型。"""

        if mode == "summary":
            if context_chunks:
                seed = " ".join(chunk.get("content", "") for chunk in context_chunks[:2]).strip()
            else:
                seed = fallback_text[:600]
            condensed = re.sub(r"\s+", " ", seed)
            if not condensed:
                return "文档中未提取到有效文本。"
            return f"文档核心内容概述：{condensed[:220]}" + ("..." if len(condensed) > 220 else "")

        if context_chunks:
            context = " ".join(chunk.get("content", "") for chunk in context_chunks[:2]).strip()
            context = re.sub(r"\s+", " ", context)
            if context:
                return (
                    f"根据文档内容，{context[:200]}。"
                    f"针对你的问题“{question}”，以上片段是最相关依据。"
                )

        return "文档中未找到足够依据。"

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        parts = re.split(r"[。！？!?\n]", text)
        return [segment.strip() for segment in parts if segment.strip()]

    @staticmethod
    def _extract_risk_points(sentences: list[str]) -> list[str]:
        keywords = ("风险", "违约", "处罚", "争议", "合规", "不足", "缺陷", "问题")
        result = [sentence for sentence in sentences if any(word in sentence for word in keywords)]
        return result[:5]

    @staticmethod
    def _build_suggested_questions(key_points: list[str]) -> list[str]:
        if not key_points:
            return [
                "这份文档的核心结论是什么？",
                "文档有哪些需要重点关注的风险？",
                "接下来建议的执行步骤是什么？",
            ]

        return [
            "文档中最重要的三条信息是什么？",
            "这些信息对当前业务决策意味着什么？",
            "如果继续推进，下一步应该优先做什么？",
        ]

    def _retrieve_top_chunks(self, question: str, chunks: list[dict]) -> list[tuple[dict, int]]:
        keywords = self._extract_keywords(question)
        if not keywords:
            return []

        scored: list[tuple[dict, int]] = []
        for chunk in chunks:
            content = str(chunk.get("content", ""))
            if not content:
                continue
            score = sum(1 for word in keywords if word in content.lower() or word in content)
            if score > 0:
                scored.append((chunk, score))

        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:3]

    @staticmethod
    def _extract_keywords(text: str) -> set[str]:
        english_tokens = re.findall(r"[A-Za-z0-9_]{2,}", text.lower())

        stop_chars = {
            "的",
            "了",
            "在",
            "是",
            "和",
            "与",
            "及",
            "并",
            "吗",
            "呢",
            "啊",
            "呀",
            "这",
            "那",
            "有",
            "无",
            "个",
            "里",
            "主要",
            "什么",
            "这个",
        }
        chinese_chars = {
            char for char in text if "\u4e00" <= char <= "\u9fff" and char not in stop_chars
        }

        return set(english_tokens) | chinese_chars

    @staticmethod
    def _calculate_confidence(matches: list[tuple[dict, int]]) -> float:
        if not matches:
            return 0.2

        total_score = sum(score for _chunk, score in matches)
        confidence = min(0.95, 0.45 + total_score * 0.08)
        return round(confidence, 2)
