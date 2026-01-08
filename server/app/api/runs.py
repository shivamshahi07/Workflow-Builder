from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from app.db.session import get_db
from app.models.workflow import WorkflowVersion
from app.models.run import WorkflowRun, NodeExecution, RunStatus
from app.schemas.workflow import WorkflowRunCreate, WorkflowRunResponse
from app.services.workflow_executor import WorkflowExecutor

router = APIRouter()


@router.get("/")
async def list_runs(db: Session = Depends(get_db)):
    """List all workflow runs"""
    runs = db.query(WorkflowRun).order_by(WorkflowRun.started_at.desc()).all()
    return {
        "runs": [
            {
                "id": run.id,
                "workflow_id": run.workflow_id,
                "status": run.status.value,
                "started_at": run.started_at.isoformat(),
                "completed_at": run.completed_at.isoformat() if run.completed_at else None
            }
            for run in runs
        ]
    }


@router.post("/")
async def create_run(
    run_data: WorkflowRunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a new workflow run"""
    
    # Get latest published version
    version = db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == run_data.workflow_id,
        WorkflowVersion.is_published == True
    ).order_by(WorkflowVersion.version.desc()).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="No published workflow version found")
    
    # Create run
    run = WorkflowRun(
        id=str(uuid.uuid4()),
        workflow_id=run_data.workflow_id,
        workflow_version_id=version.id,
        status=RunStatus.PENDING,
        trigger_data=run_data.trigger_data,
        started_at=datetime.utcnow()
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    
    run_id = run.id
    
    # Execute workflow in background with new session
    def execute_in_background():
        from app.db.session import SessionLocal
        import asyncio
        
        db_session = SessionLocal()
        try:
            executor = WorkflowExecutor(db_session)
            asyncio.run(executor.execute_workflow(run_id))
        finally:
            db_session.close()
    
    background_tasks.add_task(execute_in_background)
    
    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "status": run.status.value,
        "message": "Workflow execution started"
    }


@router.get("/{run_id}")
async def get_run(run_id: str, db: Session = Depends(get_db)):
    """Get run details"""
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Get node executions ordered by started_at
    executions = db.query(NodeExecution).filter(
        NodeExecution.run_id == run_id
    ).order_by(NodeExecution.started_at).all()
    
    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "status": run.status.value,
        "started_at": run.started_at.isoformat(),
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
        "trigger_data": run.trigger_data,
        "node_executions": [
            {
                "id": ex.id,
                "node_id": ex.node_id,
                "node_type": ex.node_type,
                "status": ex.status.value,
                "input_data": ex.input_data,
                "output_data": ex.output_data,
                "error_message": ex.error_message,
                "started_at": ex.started_at.isoformat() if ex.started_at else None,
                "completed_at": ex.completed_at.isoformat() if ex.completed_at else None
            }
            for ex in executions
        ]
    }
