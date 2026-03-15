import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiUrl } from '../api';

// Per-workflow-name input templates
const INPUT_TEMPLATES: Record<string, object> = {
  'Article Summarizer': {
    article_urls: [
      'https://en.wikipedia.org/wiki/Artificial_intelligence',
      'https://en.wikipedia.org/wiki/Machine_learning',
    ],
  },
  'Email Reply Drafter': {
    email_from: 'customer@example.com',
    customer_name: 'Jane Doe',
    subject: 'Question about my order',
    original_body:
      "Hi, I placed an order last week but haven't received a shipping confirmation. Can you help?",
    tone: 'professional',
  },
  'Finance News Digest': {
    article_urls: [
      'https://en.wikipedia.org/wiki/Stock_market',
      'https://en.wikipedia.org/wiki/Federal_Reserve',
    ],
    email_to: 'you@example.com',
    report_title: 'Daily Finance Digest',
  },
};

const DEFAULT_TEMPLATE = {
  article_urls: ['https://en.wikipedia.org/wiki/Artificial_intelligence'],
};

interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
}

function TestWorkflow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);

  // Determine appropriate template based on workflow name
  const [inputJson, setInputJson] = useState('');
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(apiUrl(`/api/workflows/${id}`))
      .then(r => r.json())
      .then((data: WorkflowInfo) => {
        setWorkflowInfo(data);
        const template = INPUT_TEMPLATES[data.name] ?? DEFAULT_TEMPLATE;
        setInputJson(JSON.stringify(template, null, 2));
      })
      .catch(() => setInputJson(JSON.stringify(DEFAULT_TEMPLATE, null, 2)));
  }, [id]);

  const handleJsonChange = (val: string) => {
    setInputJson(val);
    try {
      JSON.parse(val);
      setJsonError('');
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  const loadTemplate = (name: string) => {
    const tmpl = INPUT_TEMPLATES[name] ?? DEFAULT_TEMPLATE;
    setInputJson(JSON.stringify(tmpl, null, 2));
    setJsonError('');
  };

  const runWorkflow = async () => {
    if (jsonError) {
      toast.error('Fix JSON errors before running');
      return;
    }
    setLoading(true);
    try {
      let triggerData: object;
      try {
        triggerData = JSON.parse(inputJson);
      } catch {
        toast.error('Invalid JSON input');
        setLoading(false);
        return;
      }

      const response = await fetch(apiUrl('/api/runs/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: id, trigger_data: triggerData }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).detail || 'Server error');
      }

      toast.success('Workflow started!', { description: 'Redirecting to live view…' });
      await new Promise(resolve => setTimeout(resolve, 400));
      navigate(`/workflow/${id}`);
    } catch (err: any) {
      console.error('Failed to run workflow:', err);
      toast.error('Failed to run workflow', { description: err.message || 'Please try again.' });
      setLoading(false);
    }
  };

  const workflowName = workflowInfo?.name ?? '';

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">
            {workflowName ? `Test: ${workflowName}` : 'Test Workflow'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {workflowInfo?.description ?? 'Provide trigger input and run the workflow'}
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button onClick={() => navigate(`/workflow/${id}`)}
            className="text-sm text-indigo-600 hover:text-indigo-900">
            ← Back to Workflow
          </button>
        </div>
      </div>

      {/* Quick templates */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium">Load template:</span>
        {Object.keys(INPUT_TEMPLATES).map(name => (
          <button key={name} onClick={() => loadTemplate(name)}
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-full hover:bg-gray-50 text-gray-700 transition-colors">
            {name}
          </button>
        ))}
      </div>

      {/* JSON Editor */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Trigger Input (JSON)</h2>
          {jsonError && <span className="text-xs text-red-600 font-medium">{jsonError}</span>}
        </div>
        <textarea
          className={`w-full font-mono text-xs border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 ${
            jsonError ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-indigo-300'
          } bg-gray-50`}
          rows={16}
          spellCheck={false}
          value={inputJson}
          onChange={e => handleJsonChange(e.target.value)}
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={runWorkflow}
            disabled={loading || !!jsonError}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Starting…' : '▶ Run Workflow'}
          </button>
        </div>

        {loading && (
          <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
            <span className="animate-spin inline-block">⟳</span>
            Starting workflow execution…
          </div>
        )}
      </div>

      {/* Hints based on workflow type */}
      {workflowName === 'Email Reply Drafter' && (
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-pink-900 mb-2">✉️ Email Reply Drafter</h3>
          <ul className="text-sm text-pink-800 space-y-1">
            <li>• AI drafts a professional reply based on the customer's email</li>
            <li>• Set <code className="bg-white px-1 rounded">email_from</code> to the customer's address to send the reply automatically</li>
            <li>• Requires <strong>GMAIL_USER</strong> + <strong>GMAIL_APP_PASSWORD</strong> secrets to actually send mail</li>
            <li>• Without Gmail secrets the draft is still generated and shown in the output</li>
          </ul>
        </div>
      )}
      {workflowName === 'Finance News Digest' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-green-900 mb-2">📈 Finance News Digest</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Fetches finance articles → AI summarizes → expert analysis generated</li>
            <li>• Set <code className="bg-white px-1 rounded">email_to</code> to receive the digest via email</li>
            <li>• Requires <strong>GMAIL_USER</strong> + <strong>GMAIL_APP_PASSWORD</strong> secrets to send</li>
            <li>• Try Reuters, Yahoo Finance, Bloomberg URLs for best results</li>
          </ul>
        </div>
      )}
      {(workflowName === 'Article Summarizer' || !workflowName) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">💡 How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Paste any publicly accessible article URLs in the JSON array</li>
            <li>• AI fetches, reads, and summarizes each article</li>
            <li>• A combined overview is generated across all articles</li>
            <li>• Watch nodes light up in real-time on the workflow canvas</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default TestWorkflow;
