from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import workflows, runs, nodes, tasks
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import engine
from app.db.base import Base
import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info("🚀 Starting AI Workflow Automation Platform")
    logger.info(f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'configured'}")
    yield
    # Shutdown
    logger.info("👋 Shutting down AI Workflow Automation Platform")


app = FastAPI(
    title="AI Workflow Automation Platform",
    description="Agent-orchestrated workflow automation with HITL",
    version="0.1.0",
    lifespan=lifespan
)

# CORS (CORS_ORIGINS = comma-separated list in .env)
_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(nodes.router, prefix="/api/nodes", tags=["nodes"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])


@app.get("/")
async def root():
    return {"message": "AI Workflow Automation Platform API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
