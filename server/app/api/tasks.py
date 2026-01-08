from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/")
async def list_human_tasks(db: Session = Depends(get_db)):
    """List pending human tasks"""
    return {"tasks": []}


@router.post("/{task_id}/approve")
async def approve_task(task_id: str, db: Session = Depends(get_db)):
    """Approve a human task"""
    return {"message": "Task approved"}


@router.post("/{task_id}/reject")
async def reject_task(task_id: str, db: Session = Depends(get_db)):
    """Reject a human task"""
    return {"message": "Task rejected"}
