import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl } from '../api';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface WorkflowDetails {
  workflow: {
    id: string;
    name: string;
    description: string;
  };
  latest_version: {
    id: string;
    version: number;
    definition: {
      nodes: Node[];
      edges: Edge[];
    };
  };
  recent_runs: Array<{
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
  }>;
}

interface NodeExecution {
  id: string;
  node_id: string;
  node_type: string;
  status: string;
  input_data?: any;
  output_data?: any;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

function WorkflowDetails() {
  const { id } = useParams<{ id: string }>();
  const [details, setDetails] = useState<WorkflowDetails | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runExecutions, setRunExecutions] = useState<NodeExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [outputData, setOutputData] = useState<any>(null);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  useEffect(() => {
    fetchWorkflowDetails();
  }, [id]);

  useEffect(() => {
    if (selectedRun) {
      fetchRunExecutions(selectedRun);
    }
  }, [selectedRun]);

  // Auto-refresh when there's a running workflow
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchWorkflowDetails();
      if (selectedRun) {
        fetchRunExecutions(selectedRun);
      }
    }, 1500); // Refresh every 1.5 seconds for faster updates

    return () => clearInterval(interval);
  }, [autoRefresh, selectedRun, id]);

  // Auto-select the latest run and enable auto-refresh if it's running
  useEffect(() => {
    if (details && details.recent_runs.length > 0) {
      const latestRun = details.recent_runs[0];
      
      // Auto-select latest run if none selected
      if (!selectedRun) {
        setSelectedRun(latestRun.id);
      }
      
      // Enable auto-refresh if latest run is running or pending
      if (latestRun.status === 'running' || latestRun.status === 'pending') {
        setAutoRefresh(true);
      } else {
        setAutoRefresh(false);
      }
    }
  }, [details]);

  // Check for completed workflow and show output
  useEffect(() => {
    if (runExecutions.length > 0) {
      const outputExecution = runExecutions.find(ex => ex.node_type === 'output' && ex.status === 'success');
      if (outputExecution && outputExecution.output_data) {
        setOutputData(outputExecution.output_data);
        setShowOutput(true);
      }
    }
  }, [runExecutions]);

  const fetchWorkflowDetails = async () => {
    try {
      const response = await fetch(apiUrl(`/api/workflows/${id}/details`));
      const data = await response.json();
      setDetails(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch workflow details:', err);
      setLoading(false);
    }
  };

  const fetchRunExecutions = async (runId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/runs/${runId}`);
      const data = await response.json();
      setRunExecutions(data.node_executions || []);
    } catch (err) {
      console.error('Failed to fetch run executions:', err);
    }
  };

  const getNodeStyle = (nodeId: string) => {
    if (!selectedRun || runExecutions.length === 0) {
      return {};
    }

    const execution = runExecutions.find(ex => ex.node_id === nodeId);
    if (!execution) return {};

    const statusColors: Record<string, { background: string; border: string }> = {
      success: { background: '#d1fae5', border: '#10b981' },
      running: { background: '#dbeafe', border: '#3b82f6' },
      failed: { background: '#fee2e2', border: '#ef4444' },
      pending: { background: '#f3f4f6', border: '#9ca3af' },
    };

    const status = execution.status.toLowerCase();
    const colors = statusColors[status] || statusColors.pending;
    
    // Add extra highlight if this node is clicked
    const isHighlighted = highlightedNode === nodeId;
    
    return {
      background: colors.background,
      border: `${isHighlighted ? '4px' : '2px'} solid ${colors.border}`,
      boxShadow: status === 'running' || isHighlighted
        ? `0 0 ${isHighlighted ? '20px' : '10px'} ${colors.border}` 
        : undefined,
    };
  };

  const handleNodeClick = (nodeId: string) => {
    setHighlightedNode(nodeId);
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedNode(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 3000);
    });
  };

  const handleRerun = async () => {
    if (!details || !selectedRun || runExecutions.length === 0) return;
    
    setIsRerunning(true);
    try {
      // Get the input from the first node execution (trigger node)
      const triggerExecution = runExecutions.find(ex => ex.node_type === 'trigger');
      const inputData = triggerExecution?.input_data || {};
      
      // Run the workflow with the same inputs
      const response = await fetch(apiUrl(`/api/workflows/${id}/run`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputData),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Auto-select the new run and enable auto-refresh
        setSelectedRun(data.run_id);
        setAutoRefresh(true);
        // Refresh the workflow details to show the new run
        await fetchWorkflowDetails();
      }
    } catch (err) {
      console.error('Failed to rerun workflow:', err);
    } finally {
      setIsRerunning(false);
    }
  };

  const extractEssentialResults = (data: any) => {
    if (!data) return '';
    
    let result = '';
    const previousResults = data.previous_results?.['ai-agent-1'];
    
    if (!previousResults) return JSON.stringify(data, null, 2);
    
    // Extract individual summaries
    if (previousResults.individual_summaries) {
      result += 'ARTICLE SUMMARIES:\n\n';
      previousResults.individual_summaries.forEach((summary: any, idx: number) => {
        result += `${idx + 1}. ${summary.article_title}\n`;
        result += `${summary.summary}\n\n`;
        if (summary.key_points && summary.key_points.length > 0) {
          result += 'Key Points:\n';
          summary.key_points.forEach((point: string) => {
            result += `• ${point}\n`;
          });
          result += '\n';
        }
      });
    }
    
    // Extract combined summary
    if (previousResults.combined_summary && previousResults.combined_summary.overview) {
      result += '\n=== COMBINED OVERVIEW ===\n';
      result += previousResults.combined_summary.overview + '\n';
    }
    
    return result;
  };

  // Use React.useMemo to prevent nodes from being recreated unnecessarily
  const enhancedNodes = React.useMemo(() => {
    if (!details?.latest_version?.definition.nodes) return [];
    
    return details.latest_version.definition.nodes.map(node => {
      const nodeStyle = getNodeStyle(node.id);
      return {
        ...node,
        data: {
          ...node.data,
        },
        style: {
          padding: 10,
          borderRadius: 8,
          fontSize: 12,
          ...nodeStyle,
        },
      };
    });
  }, [details?.latest_version?.definition.nodes, runExecutions, highlightedNode]);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!details) {
    return <div className="text-center py-12">Workflow not found</div>;
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back
          </Link>
          <h1 className="text-base font-semibold text-gray-900">{details.workflow.name}</h1>
          {autoRefresh && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              🔄 Live
            </span>
          )}
          <span className="text-xs text-gray-500">{details.workflow.description}</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedRun && runExecutions.length > 0 && (
            <button
              onClick={handleRerun}
              disabled={isRerunning}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                isRerunning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isRerunning ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Running...
                </>
              ) : (
                <>
                  ▶️ Rerun
                </>
              )}
            </button>
          )}
          <Link
            to={`/test/${id}`}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
          >
            Test Workflow
          </Link>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Workflow Canvas */}
        <div className="flex-1 relative">
          {details.latest_version ? (
            <ReactFlow
              nodes={enhancedNodes}
              edges={details.latest_version.definition.edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Controls position="top-left" />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No workflow definition available
            </div>
          )}

          {/* Floating Output Display */}
          {showOutput && outputData && (
            <div className="absolute top-4 right-4 w-[500px] bg-white rounded-lg shadow-2xl border-2 border-green-500 max-h-[600px] overflow-hidden z-10">
              <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <h3 className="text-sm font-bold text-green-900">Workflow Complete - Results</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const essentialText = extractEssentialResults(outputData);
                      copyToClipboard(essentialText);
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    📋 Copy Results
                  </button>
                  <button
                    onClick={() => setShowOutput(false)}
                    className="text-green-700 hover:text-green-900 text-lg font-bold px-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[540px]">
                {outputData.previous_results?.['ai-agent-1']?.individual_summaries && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b pb-2">📰 Article Summaries</h4>
                    {outputData.previous_results['ai-agent-1'].individual_summaries.map((summary: any, idx: number) => (
                      <div key={idx} className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 rounded-r">
                        <p className="text-sm font-semibold text-gray-900 mb-1">{idx + 1}. {summary.article_title}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{summary.summary}</p>
                        {summary.key_points && summary.key_points.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Key Points:</p>
                            <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5 ml-2">
                              {summary.key_points.map((point: string, i: number) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                    {outputData.previous_results['ai-agent-1'].combined_summary && (
                      <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-300">
                        <p className="text-sm font-bold text-indigo-900 mb-2">🎯 Combined Overview</p>
                        <p className="text-sm text-indigo-800 leading-relaxed">
                          {outputData.previous_results['ai-agent-1'].combined_summary.overview}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Runs Sidebar */}
        <div className={`${selectedRun && runExecutions.length > 0 ? 'w-96' : 'w-64'} bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0 transition-all duration-300`}>
          <div className="p-2 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Recent Runs</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click to see execution
            </p>
          </div>

          {details.recent_runs.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-xs">
              No runs yet
            </div>
          ) : (
            <div>
              {/* Run List */}
              <div className="divide-y divide-gray-200">
                {details.recent_runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRun(run.id)}
                    className={`w-full text-left p-2 hover:bg-gray-50 transition-colors ${
                      selectedRun === run.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        run.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : run.status === 'running'
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : run.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                    {run.completed_at && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {Math.round(
                          (new Date(run.completed_at).getTime() - 
                           new Date(run.started_at).getTime()) / 1000
                        )}s
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Node Execution Details */}
              {selectedRun && runExecutions.length > 0 && (
                <div className="border-t-2 border-indigo-200 bg-gray-50">
                  <div className="p-2 bg-indigo-50 border-b border-indigo-200">
                    <h3 className="text-xs font-semibold text-indigo-900">Execution Details</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {runExecutions.map((execution: any) => (
                      <div key={execution.id} className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <button
                            onClick={() => handleNodeClick(execution.node_id)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {execution.node_type}
                          </button>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            execution.status === 'success' 
                              ? 'bg-green-100 text-green-800'
                              : execution.status === 'running'
                              ? 'bg-blue-100 text-blue-800'
                              : execution.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {execution.status}
                          </span>
                        </div>

                        {/* Input Data */}
                        {execution.input_data && (
                          <details className="mt-1">
                            <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                              Input
                            </summary>
                            <div className="mt-1 p-2 bg-white rounded border border-gray-200 max-h-32 overflow-y-auto">
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                                {JSON.stringify(execution.input_data, null, 2)}
                              </pre>
                            </div>
                          </details>
                        )}

                        {/* Output Data */}
                        {execution.output_data && (
                          <details className="mt-1" open>
                            <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                              Output
                            </summary>
                            <div className="mt-1 p-2 bg-white rounded border border-gray-200 max-h-48 overflow-y-auto">
                              {/* Pretty display for articles */}
                              {execution.output_data.articles && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-gray-700">
                                    Fetched {execution.output_data.articles.length} articles
                                  </p>
                                  {execution.output_data.articles.slice(0, 2).map((article: any, idx: number) => (
                                    <div key={idx} className="text-xs text-gray-600 border-l-2 border-blue-300 pl-2">
                                      <p className="font-medium">{article.title}</p>
                                      {article.error && (
                                        <p className="text-red-600">{article.error}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Pretty display for summaries */}
                              {execution.output_data.individual_summaries && (
                                <div className="space-y-2">
                                  {execution.output_data.individual_summaries.map((summary: any, idx: number) => (
                                    <div key={idx} className="border-l-2 border-green-300 pl-2">
                                      <p className="text-xs font-medium text-gray-800">{summary.article_title}</p>
                                      <p className="text-xs text-gray-600 mt-0.5">{summary.summary}</p>
                                    </div>
                                  ))}
                                  {execution.output_data.combined_summary && (
                                    <div className="mt-2 p-2 bg-indigo-50 rounded border border-indigo-200">
                                      <p className="text-xs font-medium text-indigo-900">Combined:</p>
                                      <p className="text-xs text-indigo-700 mt-0.5">
                                        {execution.output_data.combined_summary.overview}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Fallback to JSON */}
                              {!execution.output_data.articles && !execution.output_data.individual_summaries && (
                                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                                  {JSON.stringify(execution.output_data, null, 2)}
                                </pre>
                              )}
                            </div>
                          </details>
                        )}

                        {/* Error Message */}
                        {execution.error_message && (
                          <div className="mt-1 p-2 bg-red-50 rounded border border-red-200">
                            <p className="text-xs font-medium text-red-900">Error:</p>
                            <p className="text-xs text-red-700">{execution.error_message}</p>
                          </div>
                        )}

                        {/* Timing */}
                        {execution.started_at && execution.completed_at && (
                          <div className="mt-1 text-xs text-gray-500">
                            Duration: {Math.round(
                              (new Date(execution.completed_at).getTime() - 
                               new Date(execution.started_at).getTime()) / 1000
                            )}s
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Copy Toast Notification */}
      {showCopyToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-slide-up">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3">
            <span className="text-2xl">✓</span>
            <span className="font-medium">Copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowDetails;