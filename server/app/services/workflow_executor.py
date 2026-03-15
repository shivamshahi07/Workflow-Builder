"""
Workflow executor with:
  - Topological (edge-based) execution order
  - {{node_id.field}} template variable resolution in node data
  - Condition branching (true/false paths)
  - Handlers for: trigger, webhook, action, http, database, email,
    notify, aiAgent, condition, filter, loop, transform, delay,
    humanApproval, output
"""

import re
import json
import uuid
import asyncio
import smtplib
import logging
from collections import defaultdict, deque
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List

import requests as req_lib
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.run import NodeExecution, NodeStatus, RunStatus, WorkflowRun
from app.models.workflow import WorkflowVersion
from app.services.ai_agent import AIAgent
from app.services.article_fetcher import ArticleFetcher

logger = logging.getLogger("workflow")


# ── Template resolution ────────────────────────────────────────────────────────

def _get_nested(obj: Any, keys: List[str]) -> Any:
    """Safely traverse nested dict keys."""
    for k in keys:
        if isinstance(obj, dict):
            obj = obj.get(k)
        else:
            return None
    return obj


def resolve_value(value: str, trigger_data: dict, results: dict) -> str:
    """Replace {{path.to.value}} references in a string."""
    if not isinstance(value, str):
        return value

    def replacer(m: re.Match) -> str:
        path = m.group(1).strip().split(".")
        if not path:
            return m.group(0)
        if path[0] == "trigger":
            val = _get_nested(trigger_data, path[1:])
        elif path[0] in results:
            val = _get_nested(results[path[0]], path[1:])
        else:
            return m.group(0)
        return str(val) if val is not None else ""

    return re.sub(r"\{\{([^}]+)\}\}", replacer, value)


def resolve_data(data: Any, trigger_data: dict, results: dict) -> Any:
    """Recursively resolve template variables in any data structure."""
    if isinstance(data, str):
        return resolve_value(data, trigger_data, results)
    if isinstance(data, dict):
        return {k: resolve_data(v, trigger_data, results) for k, v in data.items()}
    if isinstance(data, list):
        return [resolve_data(item, trigger_data, results) for item in data]
    return data


def _parse_json_field(value: Any) -> Any:
    """Try to parse a string as JSON; return as-is if it fails."""
    if isinstance(value, str) and value.strip().startswith(("{", "[")):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass
    return value


# ── Graph utilities ───────────────────────────────────────────────────────────

def _topological_order(nodes: list, edges: list) -> list:
    """
    Kahn's algorithm. Returns nodes in execution order.
    Falls back to array order if there are no edges.
    """
    if not edges:
        return list(nodes)

    node_ids = [n["id"] for n in nodes]
    adj: Dict[str, List[str]] = defaultdict(list)
    in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}

    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        if src in in_degree and tgt in in_degree:
            adj[src].append(tgt)
            in_degree[tgt] += 1

    queue = deque([nid for nid in node_ids if in_degree[nid] == 0])
    ordered_ids: List[str] = []

    while queue:
        nid = queue.popleft()
        ordered_ids.append(nid)
        for tgt in adj[nid]:
            in_degree[tgt] -= 1
            if in_degree[tgt] == 0:
                queue.append(tgt)

    # Include any nodes left out due to cycles (shouldn't happen, but be safe)
    seen = set(ordered_ids)
    for nid in node_ids:
        if nid not in seen:
            ordered_ids.append(nid)

    lookup = {n["id"]: n for n in nodes}
    return [lookup[nid] for nid in ordered_ids if nid in lookup]


# ── Executor ─────────────────────────────────────────────────────────────────

class WorkflowExecutor:
    def __init__(self, db: Session):
        self.db = db
        self.ai_agent = AIAgent()
        self.article_fetcher = ArticleFetcher()

    # ── Top-level run ──────────────────────────────────────────────────────

    async def execute_workflow(self, run_id: str) -> Dict[str, Any]:
        logger.info(f"Starting workflow execution run_id={run_id}")

        run = self.db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
        if not run:
            logger.error(f"Run not found: {run_id}")
            return {"success": False, "error": "Run not found"}

        run.status = RunStatus.RUNNING
        self.db.commit()

        try:
            version = self.db.query(WorkflowVersion).filter(
                WorkflowVersion.id == run.workflow_version_id
            ).first()
            if not version:
                raise Exception("Workflow version not found")

            definition = version.definition
            nodes: list = definition.get("nodes", [])
            edges: list = definition.get("edges", [])

            # Build parent map and outgoing-edge map for condition branching
            # adj: node_id -> [(target_id, sourceHandle)]
            adj: Dict[str, list] = defaultdict(list)
            parents: Dict[str, set] = defaultdict(set)
            for edge in edges:
                handle = edge.get("sourceHandle") or "output"
                adj[edge["source"]].append((edge["target"], handle))
                parents[edge["target"]].add(edge["source"])

            ordered_nodes = _topological_order(nodes, edges)
            logger.info(f"Executing {len(ordered_nodes)} nodes in topological order")

            trigger_data: dict = run.trigger_data or {}
            results: Dict[str, Any] = {}
            skipped: set = set()

            for node in ordered_nodes:
                nid = node["id"]

                # Skip if every parent was skipped
                node_parents = parents.get(nid, set())
                if node_parents and all(p in skipped for p in node_parents):
                    skipped.add(nid)
                    logger.info(f"Skipping node {nid} (all parents skipped)")
                    self._record_skipped(run_id, node)
                    continue

                logger.info(f"Executing node {nid} ({node['type']})")
                result = await self.execute_node(run_id, node, trigger_data, results)
                results[nid] = result

                # For condition nodes mark the non-matching branch as skipped
                if node["type"] == "condition":
                    matched = result.get("matched_path", "true")
                    for target, handle in adj.get(nid, []):
                        if handle and handle != matched and handle != "output":
                            skipped.add(target)
                            logger.info(f"Condition branching: skipping {target} (handle={handle})")

            run.status = RunStatus.COMPLETED
            run.completed_at = datetime.utcnow()
            self.db.commit()
            logger.info(f"Workflow run {run_id} completed successfully")
            return {"success": True, "run_id": run_id, "results": results}

        except Exception as e:
            logger.error(f"Workflow run {run_id} failed: {e}", exc_info=True)
            run.status = RunStatus.FAILED
            run.error_message = str(e)
            run.completed_at = datetime.utcnow()
            self.db.commit()
            return {"success": False, "error": str(e)}

    def _record_skipped(self, run_id: str, node: dict):
        execution = NodeExecution(
            id=str(uuid.uuid4()),
            run_id=run_id,
            node_id=node["id"],
            node_type=node["type"],
            status=NodeStatus.SKIPPED,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        self.db.add(execution)
        self.db.commit()

    # ── Single-node execution ──────────────────────────────────────────────

    async def execute_node(
        self,
        run_id: str,
        node: Dict[str, Any],
        trigger_data: Dict[str, Any],
        previous_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        node_id = node["id"]
        node_type = node["type"]

        execution = NodeExecution(
            id=str(uuid.uuid4()),
            run_id=run_id,
            node_id=node_id,
            node_type=node_type,
            status=NodeStatus.RUNNING,
            input_data=trigger_data,
            started_at=datetime.utcnow(),
        )
        self.db.add(execution)
        self.db.commit()

        try:
            result = await self._dispatch(node, node_type, trigger_data, previous_results)

            execution.status = NodeStatus.SUCCESS
            execution.output_data = result
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            logger.info(f"Node {node_id} succeeded")
            return result

        except Exception as e:
            logger.error(f"Node {node_id} failed: {e}", exc_info=True)
            execution.status = NodeStatus.FAILED
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            return {"error": str(e), "node_id": node_id}

    # ── Node dispatcher ────────────────────────────────────────────────────

    async def _dispatch(
        self,
        node: dict,
        node_type: str,
        trigger_data: dict,
        results: dict,
    ) -> dict:
        data = node.get("data", {})

        # ── trigger / webhook ──────────────────────────────────────────────
        if node_type in ("trigger", "webhook"):
            article_urls = trigger_data.get("article_urls", [])
            if article_urls:
                logger.info(f"Trigger: fetching {len(article_urls)} article(s)")
                fetched = self.article_fetcher.fetch_multiple_articles(article_urls)
                return {"articles": fetched, "total_urls": len(article_urls), **trigger_data}
            return {**trigger_data, "webhook_received": True}

        # ── action (generic pass-through) ─────────────────────────────────
        elif node_type == "action":
            d = resolve_data(data, trigger_data, results)
            return {
                "executed": True,
                "action": d.get("label", "Action"),
                "input": trigger_data,
                "previous_nodes": list(results.keys()),
            }

        # ── HTTP request ──────────────────────────────────────────────────
        elif node_type in ("http", "httpRequest"):
            d = resolve_data(data, trigger_data, results)
            method = str(d.get("method", "GET")).upper()
            url = str(d.get("url", "")).strip()
            if not url:
                return {"error": "HTTP node: 'url' is required"}

            raw_headers = d.get("headers", "{}")
            raw_body = d.get("body", "{}")
            headers = _parse_json_field(raw_headers) if isinstance(raw_headers, str) else (raw_headers or {})
            body = _parse_json_field(raw_body) if isinstance(raw_body, str) else (raw_body or {})

            def _do_request():
                return req_lib.request(
                    method, url, headers=headers,
                    json=body if body else None,
                    timeout=30,
                )

            resp = await asyncio.to_thread(_do_request)
            try:
                resp_body = resp.json()
            except Exception:
                resp_body = resp.text[:2000]
            return {"status_code": resp.status_code, "success": resp.ok, "body": resp_body}

        # ── database (simulated) ──────────────────────────────────────────
        elif node_type == "database":
            d = resolve_data(data, trigger_data, results)
            operation = d.get("operation", "read")
            key = d.get("key", "data")
            value = d.get("value", "")
            if operation == "read":
                stored = trigger_data.get(key)
                return {"found": stored is not None, "key": key, "value": stored}
            return {"written": True, "key": key, "value": value}

        # ── send email (Gmail SMTP) ────────────────────────────────────────
        elif node_type in ("email", "sendEmail"):
            d = resolve_data(data, trigger_data, results)
            to_addr = str(d.get("to", "")).strip()
            subject = str(d.get("subject", "No Subject")).strip()
            body_text = str(d.get("body", "")).strip()

            gmail_user = settings.GMAIL_USER
            gmail_pass = settings.GMAIL_APP_PASSWORD

            if not gmail_user or not gmail_pass:
                logger.warning("Email node: GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping send")
                return {
                    "sent": False,
                    "reason": "Gmail not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD secrets.",
                    "preview": {"to": to_addr, "subject": subject, "body_preview": body_text[:300]},
                }
            if not to_addr:
                return {"sent": False, "reason": "No recipient ('to') specified"}

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = gmail_user
            msg["To"] = to_addr
            msg.attach(MIMEText(body_text, "plain"))

            def _send():
                with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
                    smtp.login(gmail_user, gmail_pass)
                    smtp.send_message(msg)

            await asyncio.to_thread(_send)
            logger.info(f"Email sent to {to_addr} — subject: {subject}")
            return {"sent": True, "to": to_addr, "subject": subject}

        # ── notification (webhook / Slack / generic POST) ─────────────────
        elif node_type == "notify":
            d = resolve_data(data, trigger_data, results)
            webhook_url = str(d.get("webhook_url", "")).strip()
            message = str(d.get("message", "Workflow notification"))

            if not webhook_url:
                return {"sent": False, "reason": "No webhook_url configured", "message": message}

            payload = {"text": message, "timestamp": datetime.utcnow().isoformat()}

            def _post():
                return req_lib.post(webhook_url, json=payload, timeout=10)

            resp = await asyncio.to_thread(_post)
            return {"sent": True, "status_code": resp.status_code, "message": message}

        # ── AI agent ──────────────────────────────────────────────────────
        elif node_type == "aiAgent":
            agent_type = data.get("agentType", "summarize_multiple")
            context_override = data.get("context", "")

            if agent_type == "summarize_multiple":
                articles = trigger_data.get("articles", [])
                if not articles:
                    for res in results.values():
                        if isinstance(res, dict) and "articles" in res:
                            articles = res["articles"]
                            break
                logger.info(f"AI: summarizing {len(articles)} article(s)")
                return await self.ai_agent.process_multiple_articles(articles)

            elif agent_type == "draft_email_reply":
                return await self.ai_agent.draft_email_reply(trigger_data)

            elif agent_type == "analyze_finance":
                # Find individual_summaries from the nearest previous aiAgent result
                analysis_input: dict = {}
                for res in reversed(list(results.values())):
                    if isinstance(res, dict) and "individual_summaries" in res:
                        analysis_input = res
                        break
                if not analysis_input:
                    analysis_input = trigger_data
                return await self.ai_agent.analyze_finance(analysis_input)

            else:
                # Generic instruction-based task
                instruction = data.get("instruction", f"Process the following as a {agent_type} task.")
                context = context_override or json.dumps(trigger_data, indent=2)[:3000]
                return await self.ai_agent.generic_task(instruction, context)

        # ── condition (branching) ─────────────────────────────────────────
        elif node_type == "condition":
            field_path = data.get("field", "")
            operator = data.get("operator", "==")
            compare_val = resolve_value(
                data.get("value", ""), trigger_data, results
            )

            actual_val = ""
            if field_path:
                actual_val = resolve_value(f"{{{{{field_path}}}}}", trigger_data, results)

            def _evaluate() -> bool:
                try:
                    if operator == "==":
                        return str(actual_val) == str(compare_val)
                    if operator == "!=":
                        return str(actual_val) != str(compare_val)
                    if operator == ">":
                        return float(actual_val) > float(compare_val)
                    if operator == "<":
                        return float(actual_val) < float(compare_val)
                    if operator == ">=":
                        return float(actual_val) >= float(compare_val)
                    if operator == "<=":
                        return float(actual_val) <= float(compare_val)
                    if operator == "contains":
                        return str(compare_val).lower() in str(actual_val).lower()
                    if operator == "not_contains":
                        return str(compare_val).lower() not in str(actual_val).lower()
                    if operator == "exists":
                        return bool(actual_val)
                    if operator == "not_exists":
                        return not bool(actual_val)
                except Exception:
                    pass
                return False

            condition_result = _evaluate()
            return {
                "condition_result": condition_result,
                "matched_path": "true" if condition_result else "false",
                "field": field_path,
                "field_value": actual_val,
                "operator": operator,
                "compare_value": compare_val,
            }

        # ── filter a list ─────────────────────────────────────────────────
        elif node_type == "filter":
            items_path = data.get("items_path", "")
            field = data.get("field", "")
            operator = data.get("operator", "exists")
            value = resolve_value(data.get("value", ""), trigger_data, results)

            items_raw = resolve_value(f"{{{{{items_path}}}}}", trigger_data, results) if items_path else []
            items = items_raw if isinstance(items_raw, list) else []

            filtered = []
            for item in items:
                item_val = item.get(field, "") if isinstance(item, dict) else item
                try:
                    if operator == "exists":
                        passes = bool(item_val)
                    elif operator == "==":
                        passes = str(item_val) == str(value)
                    elif operator == "!=":
                        passes = str(item_val) != str(value)
                    elif operator == "contains":
                        passes = str(value).lower() in str(item_val).lower()
                    else:
                        passes = True
                except Exception:
                    passes = True
                if passes:
                    filtered.append(item)

            return {"items": filtered, "original_count": len(items), "filtered_count": len(filtered)}

        # ── loop (pass-through, logs items) ──────────────────────────────
        elif node_type == "loop":
            items_path = data.get("items_path", "")
            items_raw = resolve_value(f"{{{{{items_path}}}}}", trigger_data, results) if items_path else []
            items = items_raw if isinstance(items_raw, list) else []
            return {"items": items, "count": len(items)}

        # ── transform (template string or pass-through) ───────────────────
        elif node_type == "transform":
            template = data.get("template", "")
            if template:
                output = resolve_value(template, trigger_data, results)
                parsed = _parse_json_field(output)
                return {"output": parsed, "template_applied": True}
            # No template → merge all available data
            merged = {**trigger_data}
            for res in results.values():
                if isinstance(res, dict):
                    merged.update(res)
            return {"output": merged, "template_applied": False}

        # ── delay ─────────────────────────────────────────────────────────
        elif node_type == "delay":
            seconds = min(float(data.get("seconds", 1)), 30)
            await asyncio.sleep(seconds)
            return {"delayed_seconds": seconds}

        # ── human approval (auto-approved for now) ────────────────────────
        elif node_type == "humanApproval":
            d = resolve_data(data, trigger_data, results)
            return {
                "approved": True,
                "message": d.get("message", "Approval required"),
                "auto_approved": True,
                "note": "Full HITL pause/resume not yet implemented — auto-approved.",
            }

        # ── output (collector) ────────────────────────────────────────────
        elif node_type == "output":
            return {"trigger_data": trigger_data, "previous_results": previous_results}

        # ── unknown ───────────────────────────────────────────────────────
        else:
            logger.warning(f"Unknown node type: {node_type}")
            return {"message": f"Node type '{node_type}' not yet implemented", "data": data}
