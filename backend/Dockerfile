# syntax=docker/dockerfile:1

# ---------- Build stage: install dependencies into a virtualenv ----------
FROM python:3.12-slim AS builder

WORKDIR /app

# System deps needed to build psycopg2 against PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ---------- Runtime stage: slim image with only what's needed to run ----------
FROM python:3.12-slim

WORKDIR /app

# Runtime library needed by psycopg2 (libpq) — no compiler/build tools here
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the app
RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY app ./app

RUN chown -R app:app /app
USER app

# Default port; hosting platforms (Render/Railway/Fly) may override via $PORT
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Shell form so $PORT is expanded at container start (required for platforms
# that inject a dynamic PORT env var)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
