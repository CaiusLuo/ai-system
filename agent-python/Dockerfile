# ==========================================
# Phase 1: Builder
# ==========================================
FROM python:3.12-slim AS builder

# Use uv for lightning-fast dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Install build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment and install dependencies
RUN uv venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN uv pip install --no-cache -r requirements.txt

# ==========================================
# Phase 2: Runtime (Clean & Slim)
# ==========================================
FROM python:3.12-slim
WORKDIR /app

# Install runtime essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

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
