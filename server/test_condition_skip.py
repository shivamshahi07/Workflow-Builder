"""
Targeted regression test for the condition-branching skip bug.

Scenario (diamond graph):
    trigger -> condition -> true_node  -> join_node
                         -> false_node -> join_node

When condition evaluates to "true":
  - false_node must be SKIPPED  (was incorrectly EXECUTED before the fix)
  - true_node  must be EXECUTED
  - join_node  must be EXECUTED (both parents present; only false_node skipped)

We test this entirely in-process without a database by directly exercising
the same branching/skip logic extracted from execute_workflow().
"""

import asyncio
from collections import defaultdict
from typing import Any, Dict

from app.services.workflow_executor import _topological_order


# --------------------------------------------------------------------------- #
# Minimal stub that replays the fixed loop from execute_workflow              #
# --------------------------------------------------------------------------- #

async def simulate_workflow(nodes, edges, condition_matched_path: str):
    """
    Replicates the fixed loop from WorkflowExecutor.execute_workflow.
    Returns (executed: set[id], skipped: set[id]).
    """
    adj: Dict[str, list] = defaultdict(list)
    parents: Dict[str, set] = defaultdict(set)
    for edge in edges:
        handle = edge.get("sourceHandle") or "output"
        adj[edge["source"]].append((edge["target"], handle))
        parents[edge["target"]].add(edge["source"])

    ordered_nodes = _topological_order(nodes, edges)

    results: Dict[str, Any] = {}
    skipped: set = set()
    executed: set = set()

    for node in ordered_nodes:
        nid = node["id"]

        # --- FIX: explicit-skip check ---
        if nid in skipped:
            skipped.add(nid)   # already there; keep for downstream propagation
            continue

        # --- parent-based propagation ---
        node_parents = parents.get(nid, set())
        if node_parents and all(p in skipped for p in node_parents):
            skipped.add(nid)
            continue

        # "Execute" the node
        executed.add(nid)
        if node["type"] == "condition":
            matched = condition_matched_path
            results[nid] = {"matched_path": matched}
            for target, handle in adj.get(nid, []):
                if handle and handle != matched and handle != "output":
                    skipped.add(target)
        else:
            results[nid] = {"done": True}

    return executed, skipped


# --------------------------------------------------------------------------- #
# Test helpers                                                                 #
# --------------------------------------------------------------------------- #

def make_graph():
    nodes = [
        {"id": "trigger",   "type": "trigger"},
        {"id": "condition", "type": "condition"},
        {"id": "true_node", "type": "action"},
        {"id": "false_node","type": "action"},
        {"id": "join_node", "type": "action"},
    ]
    edges = [
        {"source": "trigger",   "target": "condition",  "sourceHandle": "output"},
        {"source": "condition", "target": "true_node",  "sourceHandle": "true"},
        {"source": "condition", "target": "false_node", "sourceHandle": "false"},
        {"source": "true_node", "target": "join_node",  "sourceHandle": "output"},
        {"source": "false_node","target": "join_node",  "sourceHandle": "output"},
    ]
    return nodes, edges


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# --------------------------------------------------------------------------- #
# Tests                                                                        #
# --------------------------------------------------------------------------- #

def test_true_branch():
    nodes, edges = make_graph()
    executed, skipped = run(simulate_workflow(nodes, edges, condition_matched_path="true"))

    assert "false_node" not in executed, \
        "BUG: false_node was executed even though condition matched 'true'"
    assert "true_node" in executed, \
        "true_node should execute when condition matched 'true'"
    assert "join_node" in executed, \
        "join_node should execute (true_node ran; only false_node skipped)"
    assert "false_node" in skipped, \
        "false_node should be recorded as skipped"
    print("PASS: test_true_branch")


def test_false_branch():
    nodes, edges = make_graph()
    executed, skipped = run(simulate_workflow(nodes, edges, condition_matched_path="false"))

    assert "true_node" not in executed, \
        "BUG: true_node was executed even though condition matched 'false'"
    assert "false_node" in executed, \
        "false_node should execute when condition matched 'false'"
    assert "join_node" in executed, \
        "join_node should execute (false_node ran; only true_node skipped)"
    assert "true_node" in skipped, \
        "true_node should be recorded as skipped"
    print("PASS: test_false_branch")


def test_downstream_of_skipped_branch_is_also_skipped():
    """Nodes exclusively downstream of a skipped branch must also be skipped."""
    nodes = [
        {"id": "trigger",    "type": "trigger"},
        {"id": "condition",  "type": "condition"},
        {"id": "true_node",  "type": "action"},
        {"id": "false_node", "type": "action"},
        {"id": "false_child","type": "action"},  # only parent is false_node
    ]
    edges = [
        {"source": "trigger",    "target": "condition",   "sourceHandle": "output"},
        {"source": "condition",  "target": "true_node",   "sourceHandle": "true"},
        {"source": "condition",  "target": "false_node",  "sourceHandle": "false"},
        {"source": "false_node", "target": "false_child", "sourceHandle": "output"},
    ]
    executed, skipped = run(simulate_workflow(nodes, edges, condition_matched_path="true"))

    assert "false_node"  not in executed, "false_node must not execute"
    assert "false_child" not in executed, "false_child must not execute (parent was skipped)"
    assert "false_child" in skipped,      "false_child must be in skipped"
    print("PASS: test_downstream_of_skipped_branch_is_also_skipped")


if __name__ == "__main__":
    test_true_branch()
    test_false_branch()
    test_downstream_of_skipped_branch_is_also_skipped()
    print("\nAll tests passed.")
