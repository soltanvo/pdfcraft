'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { processTool, type ProcessedResult } from '@/lib/pdf/processors';
import { useAuth } from './AuthProvider';

interface WorkflowStepData {
  label: string;
  toolId: string;
  subtitle?: string;
}

const WORKFLOW_TOOLS: { id: string; label: string; category: string }[] = [
  { id: 'compress-pdf', label: 'Compress PDF', category: 'Optimize' },
  { id: 'rotate-pdf', label: 'Rotate 90°', category: 'Organize' },
  { id: 'reverse-pages', label: 'Reverse Pages', category: 'Organize' },
  { id: 'watermark', label: 'Add Watermark', category: 'Edit' },
  { id: 'page-numbers', label: 'Add Page Numbers', category: 'Edit' },
  { id: 'flatten-pdf', label: 'Flatten Forms', category: 'Secure' },
  { id: 'remove-metadata', label: 'Remove Metadata', category: 'Secure' },
  { id: 'sanitize-pdf', label: 'Sanitize PDF', category: 'Secure' },
  { id: 'linearize-pdf', label: 'Linearize PDF', category: 'Optimize' },
];

const TEMPLATES: {
  id: string;
  name: string;
  description: string;
  nodes: Node<WorkflowStepData>[];
  edges: Edge[];
}[] = [
  {
    id: 'prepare-share',
    name: 'Sanitize, Watermark & Compress',
    description: 'Strip metadata, stamp CONFIDENTIAL watermark, and optimize size',
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 60, y: 120 },
        data: { label: 'PDF Input', toolId: 'input', subtitle: 'Uploaded document' },
      },
      {
        id: 'step-1',
        position: { x: 290, y: 120 },
        data: { label: 'Remove Metadata', toolId: 'remove-metadata', subtitle: 'Strip EXIF/Info' },
      },
      {
        id: 'step-2',
        position: { x: 520, y: 120 },
        data: { label: 'Add Watermark', toolId: 'watermark', subtitle: 'CONFIDENTIAL' },
      },
      {
        id: 'step-3',
        position: { x: 750, y: 120 },
        data: { label: 'Compress PDF', toolId: 'compress-pdf', subtitle: 'Object streams' },
      },
    ],
    edges: [
      { id: 'e1', source: 'input-1', target: 'step-1', animated: true },
      { id: 'e2', source: 'step-1', target: 'step-2', animated: true },
      { id: 'e3', source: 'step-2', target: 'step-3', animated: true },
    ],
  },
  {
    id: 'archive-ready',
    name: 'Flatten, Number & Sanitize',
    description: 'Flatten interactive fields, add page numbers, and sanitize PDF',
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 60, y: 120 },
        data: { label: 'PDF Input', toolId: 'input', subtitle: 'Uploaded document' },
      },
      {
        id: 'step-1',
        position: { x: 290, y: 120 },
        data: { label: 'Flatten Forms', toolId: 'flatten-pdf' },
      },
      {
        id: 'step-2',
        position: { x: 520, y: 120 },
        data: { label: 'Add Page Numbers', toolId: 'page-numbers' },
      },
      {
        id: 'step-3',
        position: { x: 750, y: 120 },
        data: { label: 'Sanitize PDF', toolId: 'sanitize-pdf' },
      },
    ],
    edges: [
      { id: 'e1', source: 'input-1', target: 'step-1', animated: true },
      { id: 'e2', source: 'step-1', target: 'step-2', animated: true },
      { id: 'e3', source: 'step-2', target: 'step-3', animated: true },
    ],
  },
];

export function WorkflowEditor() {
  const { isPaid } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowStepData>(TEMPLATES[0].nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(TEMPLATES[0].edges);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [output, setOutput] = useState<ProcessedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const addToolNode = (toolId: string, label: string) => {
    const id = `step-${Date.now()}`;
    const lastNode = nodes[nodes.length - 1];
    const newNode: Node<WorkflowStepData> = {
      id,
      position: {
        x: lastNode ? lastNode.position.x + 220 : 280,
        y: lastNode ? lastNode.position.y : 120,
      },
      data: { label, toolId },
    };
    setNodes((nds) => [...nds, newNode]);
    if (lastNode) {
      setEdges((eds) => [
        ...eds,
        { id: `e-${lastNode.id}-${id}`, source: lastNode.id, target: id, animated: true },
      ]);
    }
  };

  const applyTemplate = (tplId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setOutput(null);
    setError(null);
  };

  const orderedSteps = useMemo(() => {
    const result: Node<WorkflowStepData>[] = [];
    const visited = new Set<string>();
    const start = nodes.find((n) => n.data.toolId === 'input') || nodes[0];
    if (!start) return result;

    let current: Node<WorkflowStepData> | undefined = start;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.data.toolId !== 'input') {
        result.push(current);
      }
      const nextEdge = edges.find((e) => e.source === current?.id);
      current = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
    }
    return result;
  }, [edges, nodes]);

  const executeWorkflow = async () => {
    if (!inputFile) {
      setError('Please upload an input PDF file first.');
      return;
    }
    if (orderedSteps.length === 0) {
      setError('Connect at least one tool step after PDF Input.');
      return;
    }

    setRunning(true);
    setError(null);
    setOutput(null);

    try {
      let currentFile = inputFile;
      let latestResult: ProcessedResult | null = null;

      for (let i = 0; i < orderedSteps.length; i++) {
        const step = orderedSteps[i];
        const isFinalStep = i === orderedSteps.length - 1;
        setActiveStep(step.data.label);
        latestResult = await processTool(step.data.toolId, [currentFile], {
          watermarkText: 'CONFIDENTIAL',
          rotationAngle: 90,
          applyFreemiumWatermark: isFinalStep && !isPaid,
        });
        currentFile = new File([latestResult.blob], latestResult.fileName, {
          type: latestResult.mimeType,
        });
      }

      if (latestResult) {
        setOutput(latestResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow execution failed.');
    } finally {
      setRunning(false);
      setActiveStep(null);
    }
  };

  const downloadOutput = () => {
    if (!output) return;
    const url = URL.createObjectURL(output.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = output.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Visual Workflow Editor
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Chain PDF operations into an automated client-side pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{inputFile ? inputFile.name : 'Select Input PDF'}</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setInputFile(f);
                  setOutput(null);
                  setError(null);
                }
              }}
            />
          </label>

          <button
            type="button"
            onClick={executeWorkflow}
            disabled={running || !inputFile}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? `Running: ${activeStep}` : `Execute (${orderedSteps.length} steps)`}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {output && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>
              Pipeline completed! Generated <strong>{output.fileName}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={downloadOutput}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download Result
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar Toolbox */}
        <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Templates
            </h2>
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl.id)}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {tpl.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{tpl.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Add Operation Node
            </h2>
            <div className="space-y-1.5">
              {WORKFLOW_TOOLS.map((wt) => (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => addToolNode(wt.id, wt.label)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <span>{wt.label}</span>
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setNodes([
                {
                  id: 'input-1',
                  type: 'input',
                  position: { x: 60, y: 120 },
                  data: { label: 'PDF Input', toolId: 'input', subtitle: 'Uploaded document' },
                },
              ]);
              setEdges([]);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear Canvas
          </button>
          <button
            type="button"
            onClick={() => applyTemplate(TEMPLATES[0].id)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 hover:text-blue-600 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>
        </aside>

        {/* ReactFlow Canvas */}
        <div className="lg:col-span-3 h-[540px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
