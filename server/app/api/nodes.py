from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/")
async def list_nodes():
    """List nodes (empty at root; use /{run_id}/nodes for a run's nodes)"""
    return {"nodes": []}


@router.get("/{run_id}/nodes")
async def list_node_executions(run_id: str, db: Session = Depends(get_db)):
    """List node executions for a run"""
    return {"nodes": []}


@router.get("/{run_id}/nodes/{node_id}")
async def get_node_execution(run_id: str, node_id: str, db: Session = Depends(get_db)):
    """Get node execution details"""
    return {"run_id": run_id, "node_id": node_id}
