# FaceFusion (open-source face swap / deepfake toolkit) - CPU build for local Kubernetes
FROM python:3.12-slim

ARG FACEFUSION_VERSION=3.9.1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    GRADIO_SERVER_NAME=0.0.0.0 \
    GRADIO_SERVER_PORT=7860

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg git ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone --depth 1 --branch ${FACEFUSION_VERSION} https://github.com/facefusion/facefusion.git . \
 && python install.py default --skip-conda \
 && rm -rf .git

# Models are downloaded at runtime into /app/.assets (mounted from a PVC so they survive restarts)
VOLUME ["/app/.assets", "/data"]

EXPOSE 7860

CMD ["python", "facefusion.py", "run", \
     "--temp-path", "/data/temp", \
     "--jobs-path", "/data/jobs", \
     "--output-path", "/data/output"]
