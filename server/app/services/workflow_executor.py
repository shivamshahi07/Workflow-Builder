from sqlalchemy.orm import Session
from app.models.workflow import Workflow, WorkflowVersion
from app.models.run import WorkflowRun, NodeExecution, RunStatus, NodeStatus
from app.services.ai_agent import AIAgent
from app.services.article_fetcher import ArticleFetcher
from typing import Dict, Any
from datetime import datetime
import uuid
import logging

logger = logging.getLogger("workflow")


class WorkflowExecutor:
    def __init__(self, db: Session):
        self.db = db
        self.ai_agent = AIAgent()
        self.article_fetcher = ArticleFetcher()
    
    async def execute_workflow(self, run_id: str) -> Dict[str, Any]:
        """Execute a workflow run"""
        logger.info(f"Starting workflow execution for run_id={run_id}")
        
        run = self.db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
        if not run:
            logger.error(f"Run not found: {run_id}")
            return {"success": False, "error": "Run not found"}
        
        # Update run status
        run.status = RunStatus.RUNNING
        self.db.commit()
        logger.info(f"Run {run_id} status updated to RUNNING")
        
        try:
            # Get workflow version
            version = self.db.query(WorkflowVersion).filter(
                WorkflowVersion.id == run.workflow_version_id
            ).first()
            
            if not version:
                raise Exception("Workflow version not found")
            
            definition = version.definition
            nodes = definition.get("nodes", [])
            edges = definition.get("edges", [])
            
            logger.info(f"Executing workflow with {len(nodes)} nodes")
            
            # Execute nodes in order
            results = {}
            for idx, node in enumerate(nodes):
                logger.info(f"Executing node {idx + 1}/{len(nodes)}: {node['id']} ({node['type']})")
                node_result = await self.execute_node(run.id, node, run.trigger_data, results)
                results[node["id"]] = node_result
                logger.info(f"Node {node['id']} completed with status: {node_result.get('status', 'unknown')}")
            
            # Mark run as completed
            run.status = RunStatus.COMPLETED
            run.completed_at = datetime.utcnow()
            self.db.commit()
            logger.info(f"Workflow run {run_id} completed successfully")
            
            return {
                "success": True,
                "run_id": run_id,
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Workflow run {run_id} failed: {str(e)}", exc_info=True)
            run.status = RunStatus.FAILED
            run.error_message = str(e)
            run.completed_at = datetime.utcnow()
            self.db.commit()
            
            return {
                "success": False,
                "error": str(e)
            }
    
    async def execute_node(
        self, 
        run_id: str, 
        node: Dict[str, Any], 
        trigger_data: Dict[str, Any],
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single node"""
        
        node_id = node["id"]
        node_type = node["type"]
        
        logger.debug(f"Creating node execution record for {node_id}")
        
        # Create node execution record
        execution = NodeExecution(
            id=str(uuid.uuid4()),
            run_id=run_id,
            node_id=node_id,
            node_type=node_type,
            status=NodeStatus.RUNNING,
            input_data=trigger_data,
            started_at=datetime.utcnow()
        )
        self.db.add(execution)
        self.db.commit()
        
        try:
            result = None
            
            if node_type == "trigger":
                logger.info(f"Trigger node: Fetching articles from URLs")
                # Trigger node - fetch articles from URLs
                article_urls = trigger_data.get("article_urls", [])
                if article_urls:
                    logger.info(f"Fetching {len(article_urls)} articles")
                    fetched_articles = self.article_fetcher.fetch_multiple_articles(article_urls)
                    result = {
                        "articles": fetched_articles,
                        "total_urls": len(article_urls)
                    }
                    logger.info(f"Successfully fetched {len(fetched_articles)} articles")
                else:
                    result = trigger_data
            
            elif node_type == "aiAgent":
                logger.info(f"AI Agent node: Processing with Gemini")
                # AI Agent node
                agent_type = node["data"].get("agentType", "summarize")
                
                if agent_type == "summarize_multiple":
                    # Get articles from previous node or trigger data
                    articles = trigger_data.get("articles", [])
                    if not articles and "trigger-1" in previous_results:
                        articles = previous_results["trigger-1"].get("articles", [])
                    
                    logger.info(f"Summarizing {len(articles)} articles with AI")
                    result = await self.ai_agent.process_multiple_articles(articles)
                    logger.info(f"AI processing completed")
                else:
                    # Single article summarization
                    article = trigger_data.get("article", {})
                    result = await self.ai_agent.summarize_article(
                        article.get("content", "")
                    )
            
            elif node_type == "output":
                logger.info(f"Output node: Collecting results")
                # Output node collects results
                result = {
                    "trigger_data": trigger_data,
                    "previous_results": previous_results
                }
            
            else:
                logger.warning(f"Unknown node type: {node_type}")
                result = {"message": f"Node type {node_type} not implemented"}
            
            # Update execution
            execution.status = NodeStatus.SUCCESS
            execution.output_data = result
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Node {node_id} executed successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"Node {node_id} execution failed: {str(e)}", exc_info=True)
            execution.status = NodeStatus.FAILED
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            
            return {"error": str(e)}
