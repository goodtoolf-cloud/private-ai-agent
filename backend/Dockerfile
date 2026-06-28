# FILE: backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    wget \
    git \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Piper TTS binary
RUN wget -q https://github.com/rhasspy/piper/releases/latest/download/piper_amd64.tar.gz \
    && tar -xzf piper_amd64.tar.gz -C /usr/local/bin \
    && rm piper_amd64.tar.gz || true

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (for advanced web reading)
RUN playwright install chromium --with-deps || true

# Copy source
COPY . .

# Create directories
RUN mkdir -p uploads generated/images generated/documents generated/audio models/piper

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
