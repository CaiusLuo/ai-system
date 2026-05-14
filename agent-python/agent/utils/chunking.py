"""文本切片工具。"""


def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[dict]:
    """按字符窗口切分文本。"""

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if chunk_overlap < 0:
        raise ValueError("chunk_overlap must be non-negative")
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    source = (text or "").strip()
    if not source:
        return []

    chunks: list[dict] = []
    step = chunk_size - chunk_overlap
    start = 0
    index = 0

    while start < len(source):
        end = min(len(source), start + chunk_size)
        content = source[start:end].strip()

        if content:
            chunks.append(
                {
                    "index": index,
                    "length": len(content),
                    "content": content,
                }
            )
            index += 1

        if end >= len(source):
            break

        start += step

    return chunks
