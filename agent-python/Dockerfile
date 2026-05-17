# ==========================================
# Phase 1: Builder
# ==========================================
FROM python:3.12-slim AS builder

# Use uv for lightning-fast dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Install build essentials with mount cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl

# Use virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies with mount cache for uv
# Copy only manifest files to leverage layer caching
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv export --format requirements-txt > requirements.txt && \
    uv pip install -r requirements.txt

# ==========================================
# Phase 2: Runtime (Clean & Slim)
# ==========================================
FROM python:3.12-slim
WORKDIR /app

# Install runtime essentials with mount cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    curl

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy source code
COPY . .

ENV HOST=0.0.0.0
ENV PORT=5001

EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5001/api/v1/health || exit 1

CMD ["python", "main.py"]
