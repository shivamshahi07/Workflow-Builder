import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiUrl } from '../api';

interface Run {
  id: string;
  workflow_id: string;
  status: string;
  created_at: string;
}

function RunDetails() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/api/runs/${id}`))
      .then(res => res.json())
      .then(data => {
        setRun(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch run:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="text-center py-12">Loading run details...</div>;
  }

  if (!run) {
    return <div className="text-center py-12">Run not found</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Run Details</h1>
          <p className="mt-2 text-sm text-gray-700">
            Execution logs and node outputs
          </p>
        </div>
      </div>

      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Run ID</dt>
            <dd className="mt-1 text-sm text-gray-900">{run.id}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm text-gray-900">{run.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default RunDetails;
