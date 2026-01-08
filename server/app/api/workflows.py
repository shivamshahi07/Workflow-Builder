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


@router.post("/example")
async def create_example_workflow(db: Session = Depends(get_db)):
    """Create an example article summarizer workflow"""
    
    # Create workflow
    workflow = Workflow(
        id=str(uuid.uuid4()),
        name="Article Summarizer",
        description="Summarize multiple articles using AI",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(workflow)
    db.commit()
    
    # Create workflow definition
    definition = {
        "nodes": [
            {
                "id": "trigger-1",
                "type": "trigger",
                "data": {"label": "Trigger: Articles Input"},
                "position": {"x": 100, "y": 100}
            },
            {
                "id": "ai-agent-1",
                "type": "aiAgent",
                "data": {
                    "label": "AI Agent: Summarize Articles",
                    "agentType": "summarize_multiple"
                },
                "position": {"x": 400, "y": 100}
            },
            {
                "id": "output-1",
                "type": "output",
                "data": {"label": "Output: Summaries"},
                "position": {"x": 700, "y": 100}
            }
        ],
        "edges": [
            {
                "id": "e1-2",
                "source": "trigger-1",
                "target": "ai-agent-1"
            },
            {
                "id": "e2-3",
                "source": "ai-agent-1",
                "target": "output-1"
            }
        ]
    }
    
    # Create version
    version = WorkflowVersion(
        id=str(uuid.uuid4()),
        workflow_id=workflow.id,
        version=1,
        definition=definition,
        is_published=True,
        published_at=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(version)
    db.commit()
    
    return {
        "workflow": {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description
        },
        "version": {
            "id": version.id,
            "version": version.version,
            "definition": definition
        }
    }
