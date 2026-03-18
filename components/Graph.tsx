'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GraphData } from '@/lib/cobolParser';

interface GraphProps {
  graphData: GraphData;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string, fileName: string) => void;
}

type NodeState = 'idle' | 'queued' | 'visiting' | 'visited';
type EdgeState = 'idle' | 'active' | 'done';
type TraversalMode = 'bfs' | 'dfs';

interface NodeViz {
  id: string;
  label: string;
  fileName: string;
  x: number;
  y: number;
  state: NodeState;
}

interface EdgeViz {
  id: string;
  source: string;
  target: string;
  state: EdgeState;
  animated: boolean;
}

interface Step {
  nodeStates: Record<string, NodeState>;
  edgeStates: Record<string, EdgeState>;
  activeEdge: string | null;
  log: string;
  callStack: string[];
}

function buildLayout(graphData: GraphData): NodeViz[] {
  if (graphData.nodes.length === 0) return [];

  // Simple layered layout: find roots (nodes with no incoming edges)
  const nodeIds = new Set(graphData.nodes.map((n) => n.id));
  const hasIncoming = new Set(graphData.edges.map((e) => e.target));
  const roots = graphData.nodes.filter((n) => !hasIncoming.has(n.id));
  const startNodes = roots.length > 0 ? roots : [graphData.nodes[0]];

  // BFS to assign layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  let currentLayer = startNodes.map((n) => n.id);

  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach((id) => visited.add(id));
    const nextLayer: string[] = [];
    for (const id of currentLayer) {
      const children = graphData.edges
        .filter((e) => e.source === id && !visited.has(e.target) && nodeIds.has(e.target))
        .map((e) => e.target);
      for (const c of children) {
        if (!visited.has(c) && !nextLayer.includes(c)) nextLayer.push(c);
      }
    }
    currentLayer = nextLayer;
  }

  // Add any isolated nodes
  graphData.nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      layers.push([n.id]);
    }
  });

  // Assign positions
  const W = 680;
  const layerH = 120;
  const nodeW = 150;
  const result: NodeViz[] = [];

  layers.forEach((layer, li) => {
    const totalW = layer.length * nodeW + (layer.length - 1) * 40;
    const startX = (W - totalW) / 2;
    layer.forEach((id, ni) => {
      const node = graphData.nodes.find((n) => n.id === id)!;
      result.push({
        id,
        label: (node.data as { label: string }).label,
        fileName: (node.data as { fileName: string }).fileName,
        x: startX + ni * (nodeW + 40) + nodeW / 2,
        y: 60 + li * layerH,
        state: 'idle',
      });
    });
  });

  return result;
}

function buildTraversalSteps(
  nodes: NodeViz[],
  edges: EdgeViz[],
  startId: string,
  mode: TraversalMode
): Step[] {
  const steps: Step[] = [];
  const nodeStateMap: Record<string, NodeState> = {};
  const edgeStateMap: Record<string, EdgeState> = {};
  nodes.forEach((n) => (nodeStateMap[n.id] = 'idle'));
  edges.forEach((e) => (edgeStateMap[e.id] = 'idle'));

  const snap = (log: string, activeEdge: string | null, callStack: string[]): void => {
    steps.push({
      nodeStates: { ...nodeStateMap },
      edgeStates: { ...edgeStateMap },
      activeEdge,
      log,
      callStack: [...callStack],
    });
  };

  const adj = (id: string) =>
    edges.filter((e) => e.source === id).map((e) => ({ edgeId: e.id, target: e.target }));

  if (mode === 'bfs') {
    const queue = [startId];
    const visited = new Set<string>();
    nodeStateMap[startId] = 'queued';
    snap(`BFS: Enqueue start node [${startId}]`, null, [startId]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      nodeStateMap[curr] = 'visiting';
      snap(`BFS: Visiting [${curr}]`, null, queue);

      const children = adj(curr);
      for (const { edgeId, target } of children) {
        edgeStateMap[edgeId] = 'active';
        snap(`BFS: Traverse edge ${curr} → ${target}`, edgeId, queue);

        if (!visited.has(target)) {
          visited.add(target);
          nodeStateMap[target] = 'queued';
          queue.push(target);
          snap(`BFS: Enqueue [${target}]`, edgeId, [...queue]);
        }
        edgeStateMap[edgeId] = 'done';
      }

      visited.add(curr);
      nodeStateMap[curr] = 'visited';
      snap(`BFS: Finished [${curr}]`, null, queue);
    }
  } else {
    // DFS
    const visited = new Set<string>();
    const callStack: string[] = [];

    const dfs = (id: string) => {
      visited.add(id);
      callStack.push(id);
      nodeStateMap[id] = 'visiting';
      snap(`DFS: Enter [${id}]`, null, [...callStack]);

      for (const { edgeId, target } of adj(id)) {
        edgeStateMap[edgeId] = 'active';
        snap(`DFS: Call ${id} → ${target}`, edgeId, [...callStack]);

        if (!visited.has(target)) {
          dfs(target);
          edgeStateMap[edgeId] = 'done';
          snap(`DFS: Return to [${id}]`, null, [...callStack]);
        } else {
          edgeStateMap[edgeId] = 'done';
          snap(`DFS: [${target}] already visited`, edgeId, [...callStack]);
        }
      }

      nodeStateMap[id] = 'visited';
      callStack.pop();
      snap(`DFS: Exit [${id}]`, null, [...callStack]);
    };

    dfs(startId);
  }

  return steps;
}

const NODE_COLORS: Record<NodeState, { fill: string; stroke: string; text: string }> = {
  idle:     { fill: '#1e2744', stroke: '#2d3a6e', text: '#a0aec0' },
  queued:   { fill: '#3d3000', stroke: '#f59e0b', text: '#fbbf24' },
  visiting: { fill: '#1a1060', stroke: '#7c3aed', text: '#a78bfa' },
  visited:  { fill: '#0d3320', stroke: '#10b981', text: '#34d399' },
};

const EDGE_COLORS: Record<EdgeState, string> = {
  idle:   '#2d3a6e',
  active: '#f59e0b',
  done:   '#10b981',
};

function Arrow({
  x1, y1, x2, y2, color, animated
}: {
  x1: number; y1: number; x2: number; y2: number; color: string; animated: boolean;
}) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;
  const nx = dx / dist, ny = dy / dist;
  // Offset endpoints so arrow starts/ends at node border
  const R = 28;
  const sx = x1 + nx * R, sy = y1 + ny * R;
  const ex = x2 - nx * R, ey = y2 - ny * R;

  const id = `arrowhead-${color.replace('#', '')}`;
  return (
    <>
      <defs>
        <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={sx} y1={sy} x2={ex} y2={ey}
        stroke={color}
        strokeWidth={animated ? 2.5 : 1.5}
        markerEnd={`url(#${id})`}
        strokeDasharray={animated ? '6 3' : undefined}
        style={animated ? { animation: 'dashFlow 0.5s linear infinite' } : undefined}
        strokeOpacity={0.9}
      />
    </>
  );
}

export default function Graph({ graphData, selectedNodeId, onNodeClick }: GraphProps) {
  const [nodeViz, setNodeViz] = useState<NodeViz[]>([]);
  const [edgeViz, setEdgeViz] = useState<EdgeViz[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(700); // ms per step
  const [mode, setMode] = useState<TraversalMode>('bfs');
  const [log, setLog] = useState('Upload files and click "▶ Play" to visualize traversal');
  const [callStack, setCallStack] = useState<string[]>([]);
  const [activeEdge, setActiveEdge] = useState<string | null>(null);
  const [currentNodeStates, setCurrentNodeStates] = useState<Record<string, NodeState>>({});
  const [currentEdgeStates, setCurrentEdgeStates] = useState<Record<string, EdgeState>>({});
  const playRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Re-layout whenever graphData changes
  useEffect(() => {
    const nv = buildLayout(graphData);
    const ev: EdgeViz[] = graphData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      state: 'idle',
      animated: false,
    }));
    setNodeViz(nv);
    setEdgeViz(ev);
    setSteps([]);
    setStepIdx(-1);
    setIsPlaying(false);
    setLog('Click a node then ▶ Play to start traversal');
    setCallStack([]);
    setActiveEdge(null);
    setCurrentNodeStates({});
    setCurrentEdgeStates({});
    if (playRef.current) clearTimeout(playRef.current);
  }, [graphData]);

  // When selected node changes, rebuild steps
  useEffect(() => {
    if (!selectedNodeId || nodeViz.length === 0) return;
    const exists = nodeViz.find((n) => n.id === selectedNodeId);
    if (!exists) return;
    const s = buildTraversalSteps(nodeViz, edgeViz, selectedNodeId, mode);
    setSteps(s);
    setStepIdx(-1);
    setIsPlaying(false);
    setLog(`Ready: ${mode.toUpperCase()} from [${selectedNodeId}]. Press ▶ Play`);
    setCallStack([]);
    setActiveEdge(null);
    setCurrentNodeStates({});
    setCurrentEdgeStates({});
    if (playRef.current) clearTimeout(playRef.current);
  }, [selectedNodeId, mode, nodeViz.length]); // eslint-disable-line

  const applyStep = useCallback((idx: number, stepList: Step[]) => {
    if (idx < 0 || idx >= stepList.length) return;
    const s = stepList[idx];
    setCurrentNodeStates(s.nodeStates);
    setCurrentEdgeStates(s.edgeStates);
    setActiveEdge(s.activeEdge);
    setLog(s.log);
    setCallStack(s.callStack);
  }, []);

  const handleStep = useCallback(() => {
    const next = stepIdx + 1;
    if (next >= steps.length) {
      setIsPlaying(false);
      setLog('✅ Traversal complete!');
      return;
    }
    setStepIdx(next);
    applyStep(next, steps);
  }, [stepIdx, steps, applyStep]);

  const handleReset = useCallback(() => {
    setStepIdx(-1);
    setIsPlaying(false);
    setCurrentNodeStates({});
    setCurrentEdgeStates({});
    setActiveEdge(null);
    setCallStack([]);
    setLog(selectedNodeId
      ? `Ready: ${mode.toUpperCase()} from [${selectedNodeId}]. Press ▶ Play`
      : 'Click a node to start');
    if (playRef.current) clearTimeout(playRef.current);
  }, [selectedNodeId, mode]);

  // Autoplay ticker
  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) clearTimeout(playRef.current);
      return;
    }
    playRef.current = setTimeout(() => {
      const next = stepIdx + 1;
      if (next >= steps.length) {
        setIsPlaying(false);
        setLog('✅ Traversal complete!');
        return;
      }
      setStepIdx(next);
      applyStep(next, steps);
    }, speed);
    return () => { if (playRef.current) clearTimeout(playRef.current); };
  }, [isPlaying, stepIdx, steps, speed, applyStep]);

  const handleNodeClickSvg = (nv: NodeViz) => {
    onNodeClick(nv.id, nv.fileName);
  };

  if (graphData.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-4">
        <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium mb-1">No Dependency Graph</p>
          <p className="text-xs text-text-muted">Upload COBOL files to visualize program dependencies</p>
        </div>
      </div>
    );
  }

  const svgH = Math.max(...nodeViz.map((n) => n.y + 80), 300);
  const progress = steps.length > 0 ? ((stepIdx + 1) / steps.length) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col bg-transparent">
      <style>{`
        @keyframes dashFlow {
          from { stroke-dashoffset: 20; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes nodeGlow {
          0%, 100% { filter: drop-shadow(0 0 6px currentColor); }
          50%       { filter: drop-shadow(0 0 14px currentColor); }
        }
        .node-visiting { animation: nodeGlow 0.8s ease-in-out infinite; }
      `}</style>

      {/* VisualAlgo-style control panel */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border bg-surface/60 backdrop-blur-sm">
        {/* Mode selector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Algorithm:</span>
          {(['bfs', 'dfs'] as TraversalMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); handleReset(); }}
              className={`px-3 py-1 text-[11px] font-bold rounded uppercase tracking-wider transition-all ${
                mode === m
                  ? 'bg-accent text-white shadow-md shadow-accent/30'
                  : 'bg-surface text-text-muted border border-border hover:border-accent/40'
              }`}
            >
              {m}
            </button>
          ))}
          <div className="flex-1" />
          {/* Speed */}
          <span className="text-[10px] text-text-muted">Speed:</span>
          <input
            type="range" min={100} max={1500} step={100}
            value={1600 - speed}
            onChange={(e) => setSpeed(1600 - Number(e.target.value))}
            className="w-20 accent-accent cursor-pointer"
          />
          <span className="text-[10px] text-text-muted w-10">{speed < 400 ? 'Fast' : speed > 1100 ? 'Slow' : 'Med'}</span>
        </div>

        {/* Step controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border hover:border-accent/40 text-text-secondary transition-all font-medium"
            title="Reset"
          >⏮ Reset</button>
          <button
            onClick={() => {
              if (steps.length === 0) return;
              const prev = Math.max(0, stepIdx - 1);
              setStepIdx(prev);
              applyStep(prev, steps);
            }}
            disabled={stepIdx <= 0}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border hover:border-accent/40 text-text-secondary transition-all font-medium disabled:opacity-30"
            title="Previous step"
          >◀ Prev</button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            disabled={steps.length === 0}
            className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all disabled:opacity-30 ${
              isPlaying
                ? 'bg-warning/20 border border-warning text-warning hover:bg-warning/30'
                : 'bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/20'
            }`}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={handleStep}
            disabled={steps.length === 0 || stepIdx >= steps.length - 1}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border hover:border-accent/40 text-text-secondary transition-all font-medium disabled:opacity-30"
            title="Next step"
          >Next ▶</button>

          {/* Progress */}
          <div className="flex-1 mx-2">
            <div className="w-full bg-border rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-text-muted tabular-nums">
            {stepIdx + 1}/{steps.length || '—'}
          </span>
        </div>
      </div>

      {/* Log bar */}
      <div className="flex-shrink-0 px-4 py-1.5 bg-surface/30 border-b border-border/50 flex items-center gap-3">
        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">LOG</span>
        <span className="text-xs text-accent font-mono">{log}</span>
      </div>

      {/* Main content: SVG graph + call stack */}
      <div className="flex-1 flex overflow-hidden">
        {/* SVG Graph */}
        <div className="flex-1 overflow-auto relative">
          <svg
            ref={svgRef}
            width="100%"
            height={Math.max(svgH + 40, 280)}
            viewBox={`0 0 700 ${Math.max(svgH + 40, 280)}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Edges */}
            {edgeViz.map((e) => {
              const src = nodeViz.find((n) => n.id === e.source);
              const tgt = nodeViz.find((n) => n.id === e.target);
              if (!src || !tgt) return null;
              const state = currentEdgeStates[e.id] || 'idle';
              const color = EDGE_COLORS[state];
              const isActive = activeEdge === e.id;
              return (
                <Arrow
                  key={e.id}
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  color={color}
                  animated={isActive}
                />
              );
            })}

            {/* Nodes */}
            {nodeViz.map((n) => {
              const state: NodeState = currentNodeStates[n.id] || 'idle';
              const colors = NODE_COLORS[state];
              const isSelected = n.id === selectedNodeId;
              const isVisiting = state === 'visiting';
              const hasFile = !!n.fileName;
              const dotColor = hasFile ? '#10b981' : '#f59e0b';

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={() => handleNodeClickSvg(n)}
                  className="cursor-pointer"
                  style={{ transition: 'all 0.3s ease' }}
                >
                  {/* Glow ring for visiting */}
                  {isVisiting && (
                    <ellipse
                      rx={70} ry={26}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={3}
                      opacity={0.4}
                      className="node-visiting"
                    />
                  )}
                  {/* Selection ring */}
                  {isSelected && (
                    <ellipse
                      rx={73} ry={29}
                      fill="none"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      opacity={0.6}
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Node body */}
                  <rect
                    x={-65} y={-20}
                    width={130} height={40}
                    rx={8} ry={8}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isSelected || isVisiting ? 2 : 1.5}
                    style={{ transition: 'all 0.4s ease' }}
                  />

                  {/* Status dot */}
                  <circle cx={-52} cy={0} r={4} fill={dotColor} opacity={0.9} />

                  {/* Label */}
                  <text
                    x={4} y={1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily="'JetBrains Mono', 'Fira Mono', monospace"
                    fontSize={11}
                    fontWeight={600}
                    fill={colors.text}
                    style={{ transition: 'fill 0.4s ease', userSelect: 'none' }}
                  >
                    {n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}
                  </text>

                  {/* State badge */}
                  {state !== 'idle' && (
                    <text
                      x={4} y={26}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontFamily="monospace"
                      fontSize={8}
                      fill={colors.stroke}
                      opacity={0.8}
                      style={{ userSelect: 'none' }}
                    >
                      {state.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Call Stack / Queue Panel */}
        <div className="w-[130px] flex-shrink-0 border-l border-border bg-surface/40 flex flex-col">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
              {mode === 'bfs' ? '📋 Queue' : '📚 Call Stack'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {callStack.length === 0 ? (
              <p className="text-[10px] text-text-muted text-center mt-4 opacity-50">Empty</p>
            ) : (
              [...(mode === 'bfs' ? callStack : [...callStack].reverse())].map((id, i) => (
                <div
                  key={`${id}-${i}`}
                  className="px-2 py-1.5 rounded-md text-[10px] font-mono font-semibold border transition-all"
                  style={{
                    backgroundColor: NODE_COLORS['queued'].fill,
                    borderColor: NODE_COLORS['queued'].stroke,
                    color: NODE_COLORS['queued'].text,
                  }}
                >
                  {id.length > 11 ? id.slice(0, 10) + '…' : id}
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="px-3 py-3 border-t border-border space-y-1.5">
            {(Object.entries(NODE_COLORS) as [NodeState, typeof NODE_COLORS[NodeState]][]).map(([state, c]) => (
              <div key={state} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.stroke }} />
                <span className="text-[9px] text-text-muted capitalize">{state}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
