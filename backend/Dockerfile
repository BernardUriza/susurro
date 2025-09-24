# Dockerfile optimized for Render.com free tier (512MB RAM limit)
# Multi-stage build to minimize final image size

# Build stage
FROM python:3.11-slim as builder

# Set environment variables for Python optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Set environment variables for production
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/root/.local/bin:$PATH" \
    MODEL_DIR="/app/models" \
    PORT=8000

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security (optional, but good practice)
RUN useradd --create-home --shell /bin/bash app

# Copy Python packages from builder stage
COPY --from=builder /root/.local /root/.local

# Set working directory
WORKDIR /app

# Copy application code
COPY main.py .

# Create models directory with proper permissions
RUN mkdir -p /app/models && chown -R app:app /app

# Switch to non-root user
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Expose port
EXPOSE 8000

# Start command optimized for memory usage
CMD ["python", "-c", "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=int(__import__('os').environ.get('PORT', 8000)), workers=1, loop='asyncio', access_log=False)"]

# Alternative start command using uvicorn directly:
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--loop", "asyncio"]

# Docker build optimization labels
LABEL maintainer="Susurro Team" \
      description="Whisper transcription service optimized for Render.com free tier" \
      version="1.0.0" \
      memory-optimized="true" \
      model="whisper-tiny"