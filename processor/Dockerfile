FROM python:3.11-slim

# 1. System packages (tesseract & deps)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        tesseract-ocr \
        libtesseract-dev \
        poppler-utils \
        build-essential \
        libgl1-mesa-glx \
        libglib2.0-0 \
        && rm -rf /var/lib/apt/lists/*

# 2. Python dependencies
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# 3. App source
WORKDIR /app
COPY src/ ./src/
ENV PYTHONPATH=/app/src

# 4. Default command (makes the container usable ad-hoc)
ENTRYPOINT ["python", "-m", "form_processor.main"] 