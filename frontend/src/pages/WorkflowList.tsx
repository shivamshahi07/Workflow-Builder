import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

interface Workflow {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

function WorkflowList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchWorkflows = () => {
    fetch(apiUrl('/api/workflows/'))
      .then(res => res.json())
      .then(data => {
        setWorkflows(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch workflows:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const createExampleWorkflow = async () => {
    try {
      const response = await fetch(apiUrl('/api/workflows/example'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.workflow) {
        alert(`Example workflow "${data.workflow.name}" created!`);
        fetchWorkflows();
        // Navigate to test page
        navigate(`/test/${data.workflow.id}`);
      }
    } catch (err) {
      console.error('Failed to create example workflow:', err);
      alert('Failed to create example workflow');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading workflows...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Workflows</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all workflows in your account
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <button
            onClick={createExampleWorkflow}
            className="inline-flex items-center justify-center rounded-md border border-indigo-600 bg-white px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50"
          >
            Create Example Workflow
          </button>
          <Link
            to="/builder"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Create Workflow
          </Link>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No workflows yet. Create your first one!</p>
          <button
            onClick={createExampleWorkflow}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Create Example Article Summarizer
          </button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Name
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Description
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Created
                      </th>
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {workflows.map((workflow) => (
                      <tr key={workflow.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {workflow.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {workflow.description}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(workflow.created_at).toLocaleDateString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link
                            to={`/workflow/${workflow.id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            View
                          </Link>
                          <Link
                            to={`/test/${workflow.id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Test
                          </Link>
                          <Link
                            to={`/builder/${workflow.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowList;
