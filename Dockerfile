# Single image: backend + pre-built frontend (build frontend locally first, then docker build)
# Build: (from repo root) cd frontend && npm run build && cd .. && docker build -t youruser/workflow-app .
# Run: docker run -p 8080:8080 -e DATABASE_URL=... -e REDIS_URL=... youruser/workflow-app

FROM python:3.12-slim

WORKDIR /app

# Backend
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ .

# Pre-built frontend (must exist at frontend/build from npm run build)
COPY frontend/build /app/static

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
