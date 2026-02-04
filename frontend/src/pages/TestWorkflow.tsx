import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

function TestWorkflow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [articleUrls, setArticleUrls] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);

  const addUrl = () => {
    setArticleUrls([...articleUrls, '']);
  };

  const removeUrl = (index: number) => {
    setArticleUrls(articleUrls.filter((_, i) => i !== index));
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...articleUrls];
    newUrls[index] = value;
    setArticleUrls(newUrls);
  };

  const runWorkflow = async () => {
    setLoading(true);

    try {
      // Start workflow run
      const response = await fetch(apiUrl('/api/runs/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_id: id,
          trigger_data: {
            article_urls: articleUrls.filter(url => url.trim() !== '')
          }
        }),
      });

      const data = await response.json();
      
      // Wait a moment to ensure the workflow has started
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Redirect to workflow details page to see execution
      navigate(`/workflow/${id}`);

    } catch (err) {
      console.error('Failed to run workflow:', err);
      alert('Failed to run workflow');
      setLoading(false);
    }
  };

  const loadExampleUrls = () => {
    setArticleUrls([
      'https://en.wikipedia.org/wiki/Artificial_intelligence',
      'https://en.wikipedia.org/wiki/Machine_learning',
      'https://en.wikipedia.org/wiki/Deep_learning'
    ]);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Test Workflow</h1>
          <p className="mt-2 text-sm text-gray-700">
            Enter article URLs to fetch and summarize using AI
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => navigate(`/workflow/${id}`)}
            className="text-sm text-indigo-600 hover:text-indigo-900"
          >
            ← Back to Workflow
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Article URLs</h2>
          <button
            onClick={loadExampleUrls}
            className="text-sm text-indigo-600 hover:text-indigo-900"
          >
            Load Example URLs
          </button>
        </div>

        {articleUrls.map((url, index) => (
          <div key={index} className="mb-4 flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => updateUrl(index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {articleUrls.length > 1 && (
              <button
                onClick={() => removeUrl(index)}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-900"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        <div className="flex gap-3">
          <button
            onClick={addUrl}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Another URL
          </button>
          
          <button
            onClick={runWorkflow}
            disabled={loading || articleUrls.every(url => !url.trim())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : 'Run Workflow'}
          </button>
        </div>

        {loading && (
          <div className="mt-4 text-sm text-gray-600">
            <p>🚀 Starting workflow execution...</p>
            <p className="text-xs mt-1">You'll be redirected to see the execution in real-time</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Enter article URLs (or use example URLs)</li>
          <li>• Click "Run Workflow" to start execution</li>
          <li>• You'll be redirected to see nodes executing in real-time</li>
          <li>• Watch as each node lights up during execution</li>
          <li>• Click on completed runs to see their execution history</li>
        </ul>
      </div>
    </div>
  );
}

export default TestWorkflow;