from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime

from app.db.session import get_db
from app.models.workflow import Workflow, WorkflowVersion
from app.schemas.workflow import WorkflowCreate, WorkflowResponse

router = APIRouter()


@router.get("/", response_model=List[WorkflowResponse])
async def list_workflows(db: Session = Depends(get_db)):
    """List all workflows"""
    workflows = db.query(Workflow).all()
    return workflows


@router.post("/", response_model=WorkflowResponse)
async def create_workflow(workflow: WorkflowCreate, db: Session = Depends(get_db)):
    """Create a new workflow"""
    db_workflow = Workflow(
        id=str(uuid.uuid4()),
        name=workflow.name,
        description=workflow.description,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Get workflow by ID"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.get("/{workflow_id}/details")
async def get_workflow_details(workflow_id: str, db: Session = Depends(get_db)):
    """Get workflow with versions and runs"""
    from app.models.run import WorkflowRun
    
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get latest version
    latest_version = db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == workflow_id,
        WorkflowVersion.is_published == True
    ).order_by(WorkflowVersion.version.desc()).first()
    
    # Get recent runs
    runs = db.query(WorkflowRun).filter(
        WorkflowRun.workflow_id == workflow_id
    ).order_by(WorkflowRun.started_at.desc()).limit(10).all()
    
    return {
        "workflow": {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "created_at": workflow.created_at
        },
        "latest_version": {
            "id": latest_version.id,
            "version": latest_version.version,
            "definition": latest_version.definition
        } if latest_version else None,
        "recent_runs": [
            {
                "id": run.id,
                "status": run.status.value,
                "started_at": run.started_at.isoformat(),
                "completed_at": run.completed_at.isoformat() if run.completed_at else None
            }
            for run in runs
        ]
    }


@router.post("/{workflow_id}/versions")
async def create_workflow_version(
    workflow_id: str,
    definition: dict,
    db: Session = Depends(get_db)
):
    """Create a new version of a workflow"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get latest version number
    latest_version = db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == workflow_id
    ).order_by(WorkflowVersion.version.desc()).first()
    
    version_number = 1 if not latest_version else latest_version.version + 1
    
    version = WorkflowVersion(
        id=str(uuid.uuid4()),
        workflow_id=workflow_id,
        version=version_number,
        definition=definition,
        is_published=True,
        published_at=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    
    return {
        "id": version.id,
        "workflow_id": workflow_id,
        "version": version_number,
        "definition": definition
    }


@router.get("/{workflow_id}/versions")
async def get_workflow_versions(workflow_id: str, db: Session = Depends(get_db)):
    """Get all versions of a workflow"""
    versions = db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == workflow_id
    ).order_by(WorkflowVersion.version.desc()).all()
    
    return [
        {
            "id": v.id,
            "version": v.version,
            "is_published": v.is_published,
            "created_at": v.created_at,
            "definition": v.definition
        }
        for v in versions
    ]


def _create_workflow_with_definition(db: Session, name: str, description: str, definition: dict):
    """Helper: create a Workflow + published WorkflowVersion and return both."""
    workflow = Workflow(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(workflow)
    db.commit()

    version = WorkflowVersion(
        id=str(uuid.uuid4()),
        workflow_id=workflow.id,
        version=1,
        definition=definition,
        is_published=True,
        published_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(version)
    db.commit()
    return workflow, version


@router.post("/example")
async def create_example_workflow(db: Session = Depends(get_db)):
    """Article Summarizer — fetch URLs and summarize with AI."""
    definition = {
        "nodes": [
            {
                "id": "trigger-1",
                "type": "trigger",
                "data": {"label": "Articles Input"},
                "position": {"x": 100, "y": 160},
            },
            {
                "id": "ai-agent-1",
                "type": "aiAgent",
                "data": {"label": "Summarize Articles", "agentType": "summarize_multiple"},
                "position": {"x": 400, "y": 160},
            },
            {
                "id": "output-1",
                "type": "output",
                "data": {"label": "Summaries Output"},
                "position": {"x": 700, "y": 160},
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "ai-agent-1"},
            {"id": "e2", "source": "ai-agent-1", "target": "output-1"},
        ],
        "input_schema": {
            "article_urls": ["https://en.wikipedia.org/wiki/Artificial_intelligence"]
        },
    }
    workflow, version = _create_workflow_with_definition(
        db, "Article Summarizer", "Fetch web articles and summarize them with AI", definition
    )
    return {
        "workflow": {"id": workflow.id, "name": workflow.name, "description": workflow.description},
        "version": {"id": version.id, "version": version.version, "definition": definition},
    }


@router.post("/example/email-reply")
async def create_email_reply_workflow(db: Session = Depends(get_db)):
    """
    Email Reply Drafter — AI drafts a professional reply and sends it via Gmail.
    Input: email_from, customer_name, subject, original_body, tone
    """
    definition = {
        "nodes": [
            {
                "id": "trigger-1",
                "type": "trigger",
                "data": {"label": "Email Input"},
                "position": {"x": 80, "y": 160},
            },
            {
                "id": "ai-draft-1",
                "type": "aiAgent",
                "data": {
                    "label": "Draft Reply",
                    "agentType": "draft_email_reply",
                },
                "position": {"x": 340, "y": 160},
            },
            {
                "id": "email-1",
                "type": "email",
                "data": {
                    "label": "Send Reply",
                    "to": "{{trigger.email_from}}",
                    "subject": "{{ai-draft-1.subject_line}}",
                    "body": "{{ai-draft-1.reply}}",
                },
                "position": {"x": 600, "y": 160},
            },
            {
                "id": "output-1",
                "type": "output",
                "data": {"label": "Done"},
                "position": {"x": 860, "y": 160},
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "ai-draft-1"},
            {"id": "e2", "source": "ai-draft-1", "target": "email-1"},
            {"id": "e3", "source": "email-1", "target": "output-1"},
        ],
        "input_schema": {
            "email_from": "customer@example.com",
            "customer_name": "Jane Doe",
            "subject": "Question about my order",
            "original_body": "Hi, I placed an order last week but haven't received a confirmation. Can you help?",
            "tone": "professional",
        },
    }
    workflow, version = _create_workflow_with_definition(
        db,
        "Email Reply Drafter",
        "AI drafts a professional reply to a customer email and sends it via Gmail",
        definition,
    )
    return {
        "workflow": {"id": workflow.id, "name": workflow.name, "description": workflow.description},
        "version": {"id": version.id, "version": version.version, "definition": definition},
    }


@router.post("/example/finance-digest")
async def create_finance_digest_workflow(db: Session = Depends(get_db)):
    """
    Finance News Digest — fetch articles → AI summarizes → AI analyses as finance expert
    → emails the report.
    Input: article_urls, email_to, report_title
    """
    definition = {
        "nodes": [
            {
                "id": "trigger-1",
                "type": "trigger",
                "data": {"label": "News Input"},
                "position": {"x": 80, "y": 180},
            },
            {
                "id": "ai-summary-1",
                "type": "aiAgent",
                "data": {"label": "Summarize Articles", "agentType": "summarize_multiple"},
                "position": {"x": 320, "y": 180},
            },
            {
                "id": "ai-finance-1",
                "type": "aiAgent",
                "data": {"label": "Finance Analysis", "agentType": "analyze_finance"},
                "position": {"x": 560, "y": 180},
            },
            {
                "id": "email-1",
                "type": "email",
                "data": {
                    "label": "Email Digest",
                    "to": "{{trigger.email_to}}",
                    "subject": "{{trigger.report_title}}",
                    "body": "{{ai-finance-1.report}}",
                },
                "position": {"x": 800, "y": 180},
            },
            {
                "id": "output-1",
                "type": "output",
                "data": {"label": "Done"},
                "position": {"x": 1040, "y": 180},
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "ai-summary-1"},
            {"id": "e2", "source": "ai-summary-1", "target": "ai-finance-1"},
            {"id": "e3", "source": "ai-finance-1", "target": "email-1"},
            {"id": "e4", "source": "email-1", "target": "output-1"},
        ],
        "input_schema": {
            "article_urls": [
                "https://www.reuters.com/markets/",
                "https://finance.yahoo.com/news/"
            ],
            "email_to": "you@example.com",
            "report_title": "Daily Finance Digest",
        },
    }
    workflow, version = _create_workflow_with_definition(
        db,
        "Finance News Digest",
        "Fetches finance news, summarizes with AI, performs expert analysis, and emails the report",
        definition,
    )
    return {
        "workflow": {"id": workflow.id, "name": workflow.name, "description": workflow.description},
        "version": {"id": version.id, "version": version.version, "definition": definition},
    }
