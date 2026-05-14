FROM python:3.12-slim
WORKDIR /app

# Install system dependencies if any (e.g., libmagic for pypdf)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=5001

EXPOSE 5001
CMD ["python", "main.py"]
