from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class NodeSchema(BaseModel):
    id: str
    type: str
    data: Dict[str, Any]
    position: Dict[str, float]


class EdgeSchema(BaseModel):
    id: str
    source: str
    target: str


class WorkflowDefinition(BaseModel):
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class WorkflowRunCreate(BaseModel):
    workflow_id: str
    trigger_data: Dict[str, Any]


class WorkflowRunResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True
