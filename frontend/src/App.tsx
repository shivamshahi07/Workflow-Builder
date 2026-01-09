import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import WorkflowList from './pages/WorkflowList';
import WorkflowBuilder from './pages/WorkflowBuilder';
import WorkflowDetails from './pages/WorkflowDetails';
import RunDetails from './pages/RunDetails';
import TestWorkflow from './pages/TestWorkflow';

function App() {
  return (
    <Router>
      <div className="h-screen flex flex-col overflow-hidden">
        <nav className="bg-white shadow-sm flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-14">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-lg font-bold text-gray-900">
                    Workflow Platform
                  </h1>
                </div>
                <div className="ml-6 flex space-x-8">
                  <Link
                    to="/"
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900"
                  >
                    Workflows
                  </Link>
                  <Link
                    to="/builder"
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                  >
                    Builder
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<WorkflowList />} />
            <Route path="/builder" element={<WorkflowBuilder />} />
            <Route path="/builder/:id" element={<WorkflowBuilder />} />
            <Route path="/workflow/:id" element={<WorkflowDetails />} />
            <Route path="/test/:id" element={<TestWorkflow />} />
            <Route path="/runs/:id" element={<RunDetails />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
