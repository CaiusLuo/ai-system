"""文本清洗工具。"""

import re


def clean_text(text: str) -> str:
    """清洗 PDF 文本，去除多余空白和无效行。"""

    if not text:
        return ""

    normalized = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", " ")
    normalized = re.sub(r"[ \t\f\v]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)

    lines = [line.strip() for line in normalized.split("\n")]
    lines = [line for line in lines if line]

    return "\n".join(lines).strip()
