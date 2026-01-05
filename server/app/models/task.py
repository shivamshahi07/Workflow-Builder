from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class HumanTask(Base):
    __tablename__ = "human_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("workflow_runs.id"), nullable=False)
    node_execution_id = Column(String, ForeignKey("node_executions.id"), nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING)
    task_type = Column(String, nullable=False)
    task_data = Column(JSON)
    ai_decision = Column(JSON)  # Store AI reasoning
    human_decision = Column(JSON)  # Store human override
    assigned_to = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    notes = Column(Text)
