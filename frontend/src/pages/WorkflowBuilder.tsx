import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Trigger' },
    position: { x: 250, y: 5 },
  },
];

const initialEdges: Edge[] = [];

function WorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeId, setNodeId] = useState(2);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode = {
      id: `${nodeId}`,
      type: 'default',
      data: { label: type },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodeId(nodeId + 1);
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="bg-white shadow-sm px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Workflow Builder</h1>
          <p className="text-xs text-gray-500">Design your workflow visually</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addNode('Action')}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            + Action
          </button>
          <button
            onClick={() => addNode('AI Agent')}
            className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
          >
            + AI Agent
          </button>
          <button
            onClick={() => addNode('Condition')}
            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
          >
            + Condition
          </button>
          <button
            onClick={() => addNode('Human Approval')}
            className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
          >
            + Human Approval
          </button>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls position="top-left" />
          <MiniMap position="center-left" style={{ top: 120 }} />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default WorkflowBuilder;
