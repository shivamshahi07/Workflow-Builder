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
  Node,
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
  X,
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
    label: 'Trigger', color: '#d97706', bgColor: '#fffbeb', headerColor: '#fef3c7',
    Icon: Zap, description: 'Start the workflow', category: 'Triggers',
    defaultLabel: 'Trigger', hasTarget: false, hasSource: true, isBranching: false,
  },
  webhook: {
    label: 'Webhook', color: '#ea580c', bgColor: '#fff7ed', headerColor: '#ffedd5',
    Icon: Globe, description: 'HTTP webhook trigger', category: 'Triggers',
    defaultLabel: 'Webhook', hasTarget: false, hasSource: true, isBranching: false,
  },
  action: {
    label: 'Action', color: '#2563eb', bgColor: '#eff6ff', headerColor: '#dbeafe',
    Icon: Play, description: 'Run a custom action', category: 'Actions',
    defaultLabel: 'Action', hasTarget: true, hasSource: true, isBranching: false,
  },
  http: {
    label: 'HTTP Request', color: '#0891b2', bgColor: '#ecfeff', headerColor: '#cffafe',
    Icon: Server, description: 'Make an API call', category: 'Actions',
    defaultLabel: 'HTTP Request', hasTarget: true, hasSource: true, isBranching: false,
  },
  database: {
    label: 'Database', color: '#16a34a', bgColor: '#f0fdf4', headerColor: '#dcfce7',
    Icon: Database, description: 'Read / write data', category: 'Actions',
    defaultLabel: 'Database', hasTarget: true, hasSource: true, isBranching: false,
  },
  email: {
    label: 'Send Email', color: '#db2777', bgColor: '#fdf2f8', headerColor: '#fce7f3',
    Icon: Mail, description: 'Send email via Gmail', category: 'Actions',
    defaultLabel: 'Send Email', hasTarget: true, hasSource: true, isBranching: false,
  },
  notify: {
    label: 'Notification', color: '#9333ea', bgColor: '#faf5ff', headerColor: '#f3e8ff',
    Icon: Bell, description: 'Send a webhook notification', category: 'Actions',
    defaultLabel: 'Notification', hasTarget: true, hasSource: true, isBranching: false,
  },
  aiAgent: {
    label: 'AI Agent', color: '#7c3aed', bgColor: '#f5f3ff', headerColor: '#ede9fe',
    Icon: Brain, description: 'AI processing task', category: 'AI & Logic',
    defaultLabel: 'AI Agent', hasTarget: true, hasSource: true, isBranching: false,
  },
  condition: {
    label: 'Condition', color: '#b45309', bgColor: '#fffbeb', headerColor: '#fef3c7',
    Icon: GitBranch, description: 'If / else branching', category: 'AI & Logic',
    defaultLabel: 'Condition', hasTarget: true, hasSource: false, isBranching: true,
  },
  filter: {
    label: 'Filter', color: '#0f766e', bgColor: '#f0fdfa', headerColor: '#ccfbf1',
    Icon: Filter, description: 'Filter items by rules', category: 'AI & Logic',
    defaultLabel: 'Filter', hasTarget: true, hasSource: true, isBranching: false,
  },
  loop: {
    label: 'Loop', color: '#0d9488', bgColor: '#f0fdfa', headerColor: '#ccfbf1',
    Icon: Repeat, description: 'Iterate over items', category: 'AI & Logic',
    defaultLabel: 'Loop', hasTarget: true, hasSource: true, isBranching: false,
  },
  transform: {
    label: 'Transform', color: '#4f46e5', bgColor: '#eef2ff', headerColor: '#e0e7ff',
    Icon: Sliders, description: 'Map / transform data', category: 'AI & Logic',
    defaultLabel: 'Transform', hasTarget: true, hasSource: true, isBranching: false,
  },
  delay: {
    label: 'Delay', color: '#475569', bgColor: '#f8fafc', headerColor: '#f1f5f9',
    Icon: Clock, description: 'Add a time delay', category: 'Flow Control',
    defaultLabel: 'Delay', hasTarget: true, hasSource: true, isBranching: false,
  },
  humanApproval: {
    label: 'Human Approval', color: '#be123c', bgColor: '#fff1f2', headerColor: '#ffe4e6',
    Icon: UserCheck, description: 'Wait for human approval', category: 'Flow Control',
    defaultLabel: 'Human Approval', hasTarget: true, hasSource: true, isBranching: false,
  },
  output: {
    label: 'Output', color: '#059669', bgColor: '#ecfdf5', headerColor: '#d1fae5',
    Icon: Flag, description: 'Final result / end node', category: 'Flow Control',
    defaultLabel: 'Output', hasTarget: true, hasSource: false, isBranching: false,
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
        minWidth: 160, maxWidth: 230,
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
      {config.hasTarget && (
        <Handle type="target" position={Position.Top}
          style={{ background: config.color, border: '2.5px solid white', width: 11, height: 11, top: -6 }}
        />
      )}
      <div style={{
        backgroundColor: config.headerColor, padding: '6px 10px',
        display: 'flex', alignItems: 'center', gap: 7,
        borderBottom: `1px solid ${config.color}28`,
      }}>
        <div style={{
          backgroundColor: config.color, borderRadius: 6, padding: '3px 4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={11} style={{ color: '#ffffff' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: config.color, letterSpacing: '0.02em' }}>
          {config.label}
        </span>
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
          {label}
        </p>
        {subtitle && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, margin: 0 }}>{subtitle}</p>
        )}
      </div>
      {config.isBranching ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 16px 6px' }}>
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>True</span>
            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>False</span>
          </div>
          <Handle type="source" position={Position.Bottom} id="true"
            style={{ left: '27%', background: '#16a34a', border: '2.5px solid white', width: 11, height: 11, bottom: -6 }}
          />
          <Handle type="source" position={Position.Bottom} id="false"
            style={{ left: '73%', background: '#dc2626', border: '2.5px solid white', width: 11, height: 11, bottom: -6 }}
          />
        </>
      ) : config.hasSource ? (
        <Handle type="source" position={Position.Bottom}
          style={{ background: config.color, border: '2.5px solid white', width: 11, height: 11, bottom: -6 }}
        />
      ) : null}
    </div>
  );
};

const nodeTypes: Record<string, React.ComponentType<NodeProps>> = {
  trigger: CustomNode, webhook: CustomNode, action: CustomNode,
  http: CustomNode, database: CustomNode, email: CustomNode, notify: CustomNode,
  aiAgent: CustomNode, condition: CustomNode, filter: CustomNode,
  loop: CustomNode, transform: CustomNode, delay: CustomNode,
  humanApproval: CustomNode, output: CustomNode,
};

const initialNodes = [
  { id: 'node-1', type: 'trigger', data: { label: 'Start', nodeType: 'trigger' }, position: { x: 240, y: 120 } },
];
const initialEdges: Edge[] = [];

// ─── Properties panel ────────────────────────────────────────────────────────

function field(label: string, el: React.ReactNode) {
  return (
    <div key={label} className="mb-3">
      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      {el}
    </div>
  );
}

const INPUT_CLS = "w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";
const TEXTAREA_CLS = `${INPUT_CLS} resize-none font-mono`;
const SELECT_CLS = `${INPUT_CLS} bg-white`;

function PropertiesPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: Node;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onClose: () => void;
}) {
  const nodeType = node.type ?? 'action';
  const config = NODE_CONFIGS[nodeType] ?? NODE_CONFIGS.action;
  const data = (node.data as any) ?? {};
  const Icon: LucideIcon = config.Icon;

  const set = (key: string, val: any) => {
    onUpdate(node.id, { ...data, [key]: val });
  };

  const inp = (key: string, placeholder = '') => (
    <input className={INPUT_CLS} value={data[key] ?? ''} placeholder={placeholder}
      onChange={e => set(key, e.target.value)} />
  );
  const ta = (key: string, rows = 3, placeholder = '') => (
    <textarea className={TEXTAREA_CLS} rows={rows} value={data[key] ?? ''} placeholder={placeholder}
      onChange={e => set(key, e.target.value)} />
  );
  const sel = (key: string, options: { value: string; label: string }[]) => (
    <select className={SELECT_CLS} value={data[key] ?? options[0]?.value ?? ''}
      onChange={e => set(key, e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const commonFields = field('Label', inp('label', config.defaultLabel));

  const typeFields: Record<string, React.ReactNode> = {
    http: (
      <>
        {field('Method', sel('method', [
          { value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' }, { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ]))}
        {field('URL', inp('url', 'https://api.example.com/endpoint'))}
        {field('Headers (JSON)', ta('headers', 2, '{"Authorization": "Bearer ..."}'))}
        {field('Body (JSON)', ta('body', 3, '{"key": "value"}'))}
      </>
    ),
    database: (
      <>
        {field('Operation', sel('operation', [
          { value: 'read', label: 'Read' }, { value: 'write', label: 'Write' },
        ]))}
        {field('Key', inp('key', 'my_data_key'))}
        {field('Value (write only)', inp('value', '{{trigger.some_field}}'))}
      </>
    ),
    email: (
      <>
        {field('To', inp('to', 'recipient@example.com or {{trigger.email_from}}'))}
        {field('Subject', inp('subject', 'Re: {{trigger.subject}}'))}
        {field('Body', ta('body', 5, 'Use {{node-id.field}} to reference previous results'))}
        <p className="text-xs text-gray-400 mt-1">
          Requires <code className="bg-gray-100 px-1 rounded">GMAIL_USER</code> + <code className="bg-gray-100 px-1 rounded">GMAIL_APP_PASSWORD</code> secrets.
        </p>
      </>
    ),
    notify: (
      <>
        {field('Webhook URL', inp('webhook_url', 'https://hooks.slack.com/...'))}
        {field('Message', ta('message', 2, 'Use {{node-id.field}} for dynamic content'))}
      </>
    ),
    aiAgent: (
      <>
        {field('Agent Type', sel('agentType', [
          { value: 'summarize_multiple', label: 'Summarize Articles' },
          { value: 'draft_email_reply', label: 'Draft Email Reply' },
          { value: 'analyze_finance', label: 'Finance Analysis' },
          { value: 'generic', label: 'Generic AI Task' },
        ]))}
        {data.agentType === 'generic' && field('Instruction', ta('instruction', 3, 'Describe what the AI should do with the input…'))}
      </>
    ),
    condition: (
      <>
        {field('Field (e.g. trigger.count)', inp('field', 'trigger.total_urls'))}
        {field('Operator', sel('operator', [
          { value: '==', label: 'equals (==)' }, { value: '!=', label: 'not equals (!=)' },
          { value: '>', label: 'greater than (>)' }, { value: '<', label: 'less than (<)' },
          { value: '>=', label: '>=' }, { value: '<=', label: '<=' },
          { value: 'contains', label: 'contains' }, { value: 'not_contains', label: 'does not contain' },
          { value: 'exists', label: 'exists (not empty)' }, { value: 'not_exists', label: 'does not exist' },
        ]))}
        {field('Value', inp('value', '3'))}
      </>
    ),
    filter: (
      <>
        {field('Items Path (e.g. trigger.articles)', inp('items_path', 'trigger.articles'))}
        {field('Field to check', inp('field', 'success'))}
        {field('Operator', sel('operator', [
          { value: 'exists', label: 'exists' }, { value: '==', label: 'equals' },
          { value: '!=', label: 'not equals' }, { value: 'contains', label: 'contains' },
        ]))}
        {field('Value', inp('value', 'true'))}
      </>
    ),
    loop: (
      <>
        {field('Items Path (e.g. trigger.articles)', inp('items_path', 'trigger.articles'))}
      </>
    ),
    transform: (
      <>
        {field('Template', ta('template', 4, 'Use {{trigger.field}} or {{node-id.field}} — output is the resolved string or JSON'))}
      </>
    ),
    delay: (
      <>
        {field('Delay (seconds, max 30)', (
          <input type="number" className={INPUT_CLS} min={0} max={30} step={0.5}
            value={data.seconds ?? 1} onChange={e => set('seconds', parseFloat(e.target.value))} />
        ))}
      </>
    ),
    humanApproval: (
      <>
        {field('Approval Message', ta('message', 2, 'Describe what needs to be approved…'))}
      </>
    ),
  };

  return (
    <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0"
        style={{ backgroundColor: config.headerColor }}>
        <div className="flex items-center gap-2">
          <div className="rounded-md p-1.5" style={{ backgroundColor: config.color }}>
            <Icon size={12} style={{ color: '#fff' }} />
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: config.color }}>{config.label}</p>
            <p className="text-xs text-gray-500">{node.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/10 text-gray-500">
          <X size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4">
        {commonFields}
        {typeFields[nodeType] ?? (
          <p className="text-xs text-gray-400 mt-2">No additional configuration for this node type.</p>
        )}

        {/* Template variable hint */}
        <div className="mt-4 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">Template variables</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Use <code className="bg-white px-1 rounded border border-slate-200">{'{{trigger.field}}'}</code> for trigger input<br />
            Use <code className="bg-white px-1 rounded border border-slate-200">{'{{node-id.field}}'}</code> for previous node output
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Inner builder ────────────────────────────────────────────────────────────

function WorkflowBuilderInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null;

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({
          ...params,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }, eds)
      ),
    [setEdges]
  );

  const addNode = useCallback(
    (type: string) => {
      const config = NODE_CONFIGS[type] ?? NODE_CONFIGS.action;
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const jitter = () => (Math.random() - 0.5) * 80;
      const position = screenToFlowPosition({
        x: bounds.left + bounds.width / 2 + jitter(),
        y: bounds.top + bounds.height / 2 + jitter(),
      });
      const id = `node-${nodeIdCounter}`;
      setNodes((nds) => [
        ...nds,
        { id, type, data: { label: config.defaultLabel, nodeType: type }, position },
      ]);
      setNodeIdCounter((c) => c + 1);
      setSelectedNodeId(id);
      toast.success(`${config.label} node added`, { duration: 1500 });
    },
    [nodeIdCounter, screenToFlowPosition]
  );

  const updateNodeData = useCallback((nodeId: string, newData: Record<string, any>) => {
    setNodes((nds: any[]) => nds.map((n: any) => n.id === nodeId ? { ...n, data: newData } : n));
  }, []);

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
      const id = `node-${nodeIdCounter}`;
      setNodes((nds) => [
        ...nds,
        { id, type, data: { label: config.defaultLabel, nodeType: type }, position },
      ]);
      setNodeIdCounter((c) => c + 1);
      setSelectedNodeId(id);
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
    setSelectedNodeId(null);
    toast.info('Canvas reset to default');
  };

  const nonTriggerCount = nodes.filter((n) => n.type !== 'trigger').length;

  return (
    <div className="h-full w-full flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">Workflow Builder</h1>
            <p className="text-xs text-gray-400 leading-tight">Click or drag nodes · click a node to configure</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:block">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} &middot; {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </span>
          <button onClick={resetCanvas}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            Reset
          </button>
          <button onClick={() => toast.info('Workflow saved! (demo)', { description: 'Connect a backend to persist.' })}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — node types */}
        {sidebarOpen && (
          <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-3 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 px-1">Node Types</p>
              {NODE_CATEGORIES.map((cat) => (
                <div key={cat.name} className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-1">{cat.name}</p>
                  <div className="space-y-1">
                    {cat.types.map((type) => {
                      const cfg = NODE_CONFIGS[type];
                      if (!cfg) return null;
                      const Icon: LucideIcon = cfg.Icon;
                      return (
                        <div key={type}
                          className="flex items-center gap-2.5 p-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-50 border border-transparent hover:border-gray-200 group transition-all select-none"
                          draggable
                          onDragStart={(e) => onDragStart(e, type)}
                          onClick={() => addNode(type)}
                          title={`${cfg.description} — click to add or drag`}>
                          <div className="flex-shrink-0 rounded-md p-1.5 transition-colors"
                            style={{ backgroundColor: cfg.color + '1a' }}>
                            <Icon size={13} style={{ color: cfg.color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-700 leading-tight group-hover:text-gray-900">{cfg.label}</p>
                            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">{cfg.description}</p>
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

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-slate-50" ref={canvasRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
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
            <MiniMap position="bottom-left"
              nodeColor={(node) => NODE_CONFIGS[node.type ?? '']?.color ?? '#94a3b8'}
              style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }} />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />

            {nonTriggerCount === 0 && (
              <Panel position="top-center">
                <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-200 text-center mt-8"
                  style={{ pointerEvents: 'none', minWidth: 210 }}>
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

        {/* Right panel — node properties */}
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}

export default WorkflowBuilder;
