# Backend LearnHub (FastAPI). Build: docker build -t learnhub-api backend/
# Chạy: docker run -p 8000:8000 --env-file backend/.env learnhub-api
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Cài dependency trước để cache layer khi chỉ đổi code
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app

# Không chạy bằng root
RUN useradd -r -u 10001 learnhub && chown -R learnhub /app
USER learnhub

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"

# --proxy-headers + forwarded-allow-ips: chạy sau reverse proxy (Render, Railway, nginx) đọc đúng IP khách cho rate limit
# PORT do nền tảng cấp (Render đặt PORT), mặc định 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --no-access-log --workers ${WEB_CONCURRENCY:-1}"]
