import React, { useCallback, useState, useRef } from 'react';
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
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  NodeProps,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Zap,
  Globe,
  Play,
  Server,
  Database,
  Bell,
  Brain,
  GitBranch,
  Repeat,
  Sliders,
  Clock,
  UserCheck,
  Flag,
  ChevronLeft,
  ChevronRight,
  Layers,
  Mail,
  Filter,
  LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Node type configs ────────────────────────────────────────────────────────

type NodeConfig = {
  label: string;
  color: string;
  bgColor: string;
  headerColor: string;
  Icon: LucideIcon;
  description: string;
  category: string;
  defaultLabel: string;
  hasTarget: boolean;
  hasSource: boolean;
  isBranching: boolean;
};

const NODE_CONFIGS: Record<string, NodeConfig> = {
  trigger: {
    label: 'Trigger',
    color: '#d97706',
    bgColor: '#fffbeb',
    headerColor: '#fef3c7',
    Icon: Zap,
    description: 'Start the workflow',
    category: 'Triggers',
    defaultLabel: 'Trigger',
    hasTarget: false,
    hasSource: true,
    isBranching: false,
  },
  webhook: {
    label: 'Webhook',
    color: '#ea580c',
    bgColor: '#fff7ed',
    headerColor: '#ffedd5',
    Icon: Globe,
    description: 'HTTP webhook trigger',
    category: 'Triggers',
    defaultLabel: 'Webhook',
    hasTarget: false,
    hasSource: true,
    isBranching: false,
  },
  action: {
    label: 'Action',
    color: '#2563eb',
    bgColor: '#eff6ff',
    headerColor: '#dbeafe',
    Icon: Play,
    description: 'Run a custom action',
    category: 'Actions',
    defaultLabel: 'Action',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  http: {
    label: 'HTTP Request',
    color: '#0891b2',
    bgColor: '#ecfeff',
    headerColor: '#cffafe',
    Icon: Server,
    description: 'Make an API call',
    category: 'Actions',
    defaultLabel: 'HTTP Request',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  database: {
    label: 'Database',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    headerColor: '#dcfce7',
    Icon: Database,
    description: 'Read / write data',
    category: 'Actions',
    defaultLabel: 'Database',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  email: {
    label: 'Send Email',
    color: '#db2777',
    bgColor: '#fdf2f8',
    headerColor: '#fce7f3',
    Icon: Mail,
    description: 'Send an email',
    category: 'Actions',
    defaultLabel: 'Send Email',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  notify: {
    label: 'Notification',
    color: '#9333ea',
    bgColor: '#faf5ff',
    headerColor: '#f3e8ff',
    Icon: Bell,
    description: 'Push / Slack / webhook notification',
    category: 'Actions',
    defaultLabel: 'Notification',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  aiAgent: {
    label: 'AI Agent',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    headerColor: '#ede9fe',
    Icon: Brain,
    description: 'AI processing task',
    category: 'AI & Logic',
    defaultLabel: 'AI Agent',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  condition: {
    label: 'Condition',
    color: '#b45309',
    bgColor: '#fffbeb',
    headerColor: '#fef3c7',
    Icon: GitBranch,
    description: 'If / else branching',
    category: 'AI & Logic',
    defaultLabel: 'Condition',
    hasTarget: true,
    hasSource: false,
    isBranching: true,
  },
  filter: {
    label: 'Filter',
    color: '#0f766e',
    bgColor: '#f0fdfa',
    headerColor: '#ccfbf1',
    Icon: Filter,
    description: 'Filter items by rules',
    category: 'AI & Logic',
    defaultLabel: 'Filter',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  loop: {
    label: 'Loop',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    headerColor: '#ccfbf1',
    Icon: Repeat,
    description: 'Iterate over items',
    category: 'AI & Logic',
    defaultLabel: 'Loop',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  transform: {
    label: 'Transform',
    color: '#4f46e5',
    bgColor: '#eef2ff',
    headerColor: '#e0e7ff',
    Icon: Sliders,
    description: 'Map / transform data',
    category: 'AI & Logic',
    defaultLabel: 'Transform',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  delay: {
    label: 'Delay',
    color: '#475569',
    bgColor: '#f8fafc',
    headerColor: '#f1f5f9',
    Icon: Clock,
    description: 'Add a time delay',
    category: 'Flow Control',
    defaultLabel: 'Delay',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  humanApproval: {
    label: 'Human Approval',
    color: '#be123c',
    bgColor: '#fff1f2',
    headerColor: '#ffe4e6',
    Icon: UserCheck,
    description: 'Wait for human approval',
    category: 'Flow Control',
    defaultLabel: 'Human Approval',
    hasTarget: true,
    hasSource: true,
    isBranching: false,
  },
  output: {
    label: 'Output',
    color: '#059669',
    bgColor: '#ecfdf5',
    headerColor: '#d1fae5',
    Icon: Flag,
    description: 'Final result / end node',
    category: 'Flow Control',
    defaultLabel: 'Output',
    hasTarget: true,
    hasSource: false,
    isBranching: false,
  },
};

const NODE_CATEGORIES = [
  { name: 'Triggers', types: ['trigger', 'webhook'] },
  { name: 'Actions', types: ['action', 'http', 'database', 'email', 'notify'] },
  { name: 'AI & Logic', types: ['aiAgent', 'condition', 'filter', 'loop', 'transform'] },
  { name: 'Flow Control', types: ['delay', 'humanApproval', 'output'] },
];

// ─── Custom node component ────────────────────────────────────────────────────

const CustomNode = ({ data, selected, type }: NodeProps) => {
  const nodeType = type ?? 'action';
  const config = NODE_CONFIGS[nodeType] ?? NODE_CONFIGS.action;
  const Icon: LucideIcon = config.Icon;
  const label = (data as any).label as string;
  const subtitle = (data as any).subtitle as string | undefined;

  return (
    <div
      style={{
        minWidth: 160,
        maxWidth: 230,
        border: `2px solid ${selected ? config.color : '#cbd5e1'}`,
        borderRadius: 12,
        backgroundColor: config.bgColor,
        boxShadow: selected
          ? `0 0 0 4px ${config.color}33, 0 4px 16px rgba(0,0,0,0.12)`
          : '0 2px 8px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        fontFamily: 'inherit',
      }}
    >
      {/* Target handle */}
      {config.hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: config.color,
            border: '2.5px solid white',
            width: 11,
            height: 11,
            top: -6,
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          backgroundColor: config.headerColor,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          borderBottom: `1px solid ${config.color}28`,
        }}
      >
        <div
          style={{
            backgroundColor: config.color,
            borderRadius: 6,
            padding: '3px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={11} style={{ color: '#ffffff' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: config.color, letterSpacing: '0.02em' }}>
          {config.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
          {label}
        </p>
        {subtitle && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Source handles */}
      {config.isBranching ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '2px 16px 6px',
            }}
          >
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>True</span>
            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>False</span>
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{
              left: '27%',
              background: '#16a34a',
              border: '2.5px solid white',
              width: 11,
              height: 11,
              bottom: -6,
            }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{
              left: '73%',
              background: '#dc2626',
              border: '2.5px solid white',
              width: 11,
              height: 11,
              bottom: -6,
            }}
          />
        </>
      ) : config.hasSource ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: config.color,
            border: '2.5px solid white',
            width: 11,
            height: 11,
            bottom: -6,
          }}
        />
      ) : null}
    </div>
  );
};

// Register each type mapping to CustomNode (must be outside component to be stable)
const nodeTypes: Record<string, React.ComponentType<NodeProps>> = {
  trigger: CustomNode,
  webhook: CustomNode,
  action: CustomNode,
  http: CustomNode,
  database: CustomNode,
  email: CustomNode,
  notify: CustomNode,
  aiAgent: CustomNode,
  condition: CustomNode,
  filter: CustomNode,
  loop: CustomNode,
  transform: CustomNode,
  delay: CustomNode,
  humanApproval: CustomNode,
  output: CustomNode,
};

// ─── Initial state ────────────────────────────────────────────────────────────

const initialNodes = [
  {
    id: 'node-1',
    type: 'trigger',
    data: { label: 'Start', nodeType: 'trigger' },
    position: { x: 240, y: 120 },
  },
];

const initialEdges: Edge[] = [];

// ─── Inner builder (needs ReactFlow context via ReactFlowProvider) ─────────────

function WorkflowBuilderInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            style: { stroke: '#94a3b8', strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Place new node at the visible center of the canvas
  const addNode = useCallback(
    (type: string) => {
      const config = NODE_CONFIGS[type] ?? NODE_CONFIGS.action;
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return;

      // jitter so multiple nodes don't stack exactly
      const jitter = () => (Math.random() - 0.5) * 80;
      const position = screenToFlowPosition({
        x: bounds.left + bounds.width / 2 + jitter(),
        y: bounds.top + bounds.height / 2 + jitter(),
      });

      setNodes((nds) => [
        ...nds,
        {
          id: `node-${nodeIdCounter}`,
          type,
          data: { label: config.defaultLabel, nodeType: type },
          position,
        },
      ]);
      setNodeIdCounter((c) => c + 1);
      toast.success(`${config.label} node added`, { duration: 1500 });
    },
    [nodeIdCounter, screenToFlowPosition]
  );

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, type: string) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type || !NODE_CONFIGS[type]) return;
      const config = NODE_CONFIGS[type];
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      setNodes((nds) => [
        ...nds,
        {
          id: `node-${nodeIdCounter}`,
          type,
          data: { label: config.defaultLabel, nodeType: type },
          position,
        },
      ]);
      setNodeIdCounter((c) => c + 1);
      toast.success(`${config.label} node added`, { duration: 1500 });
    },
    [nodeIdCounter, screenToFlowPosition]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const resetCanvas = () => {
    setNodes([{ ...initialNodes[0] }]);
    setEdges([]);
    setNodeIdCounter(2);
    toast.info('Canvas reset to default');
  };

  const nonTriggerCount = nodes.filter((n) => n.type !== 'trigger').length;

  return (
    <div className="h-full w-full flex flex-col">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">Workflow Builder</h1>
            <p className="text-xs text-gray-400 leading-tight">
              {sidebarOpen ? 'Click or drag nodes onto the canvas' : 'Open sidebar to add nodes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:block">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} &middot; {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={resetCanvas}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => toast.info('Workflow saved! (demo)', { description: 'Connect a backend to persist workflows.' })}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left sidebar ── */}
        {sidebarOpen && (
          <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-3 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 px-1">
                Node Types
              </p>

              {NODE_CATEGORIES.map((cat) => (
                <div key={cat.name} className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-1">{cat.name}</p>
                  <div className="space-y-1">
                    {cat.types.map((type) => {
                      const cfg = NODE_CONFIGS[type];
                      if (!cfg) return null;
                      const Icon: LucideIcon = cfg.Icon;
                      return (
                        <div
                          key={type}
                          className="flex items-center gap-2.5 p-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-50 border border-transparent hover:border-gray-200 group transition-all select-none"
                          draggable
                          onDragStart={(e) => onDragStart(e, type)}
                          onClick={() => addNode(type)}
                          title={`${cfg.description} — click to add or drag to position`}
                        >
                          <div
                            className="flex-shrink-0 rounded-md p-1.5 transition-colors"
                            style={{ backgroundColor: cfg.color + '1a' }}
                          >
                            <Icon size={13} style={{ color: cfg.color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-700 leading-tight group-hover:text-gray-900">
                              {cfg.label}
                            </p>
                            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
                              {cfg.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-hidden bg-slate-50" ref={canvasRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.4 }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }}
            deleteKeyCode="Delete"
          >
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              position="bottom-left"
              nodeColor={(node) => NODE_CONFIGS[node.type ?? '']?.color ?? '#94a3b8'}
              style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />

            {/* Empty state hint */}
            {nonTriggerCount === 0 && (
              <Panel position="top-center">
                <div
                  className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-200 text-center mt-8"
                  style={{ pointerEvents: 'none', minWidth: 210 }}
                >
                  <Layers size={26} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700 mb-1">Build your workflow</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Click a node in the sidebar,<br />or drag it onto the canvas
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

// ─── Exported component (wrapped with ReactFlowProvider so useReactFlow works) ─

function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}

export default WorkflowBuilder;
