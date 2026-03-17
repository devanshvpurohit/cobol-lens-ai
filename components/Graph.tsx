'use client';

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphData } from '@/lib/cobolParser';

interface GraphProps {
  graphData: GraphData;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string, fileName: string) => void;
}

// Custom node component
function CobolNode({ data }: { data: { label: string; fileName: string; isSelected: boolean } }) {
  const hasFile = !!data.fileName;

  return (
    <div
      className={`px-5 py-3 rounded-xl border-2 transition-all cursor-pointer min-w-[140px] text-center ${
        data.isSelected
          ? 'bg-accent/20 border-accent shadow-lg shadow-accent/20'
          : hasFile
          ? 'bg-surface border-border hover:border-accent/50 hover:shadow-md hover:shadow-accent/10'
          : 'bg-surface/50 border-border/50 border-dashed'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent !w-2 !h-2 !border-0" />
      <div className="flex items-center justify-center gap-2">
        <div className={`w-2 h-2 rounded-full ${hasFile ? 'bg-success' : 'bg-warning'}`} />
        <span
          className={`text-xs font-bold tracking-wide ${
            data.isSelected ? 'text-accent' : 'text-foreground'
          }`}
        >
          {data.label}
        </span>
      </div>
      {!hasFile && (
        <p className="text-[9px] text-text-muted mt-1">External</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent !w-2 !h-2 !border-0" />
    </div>
  );
}

const nodeTypes = { cobolNode: CobolNode };

export default function Graph({ graphData, selectedNodeId, onNodeClick }: GraphProps) {
  const mapNodes = useCallback(
    (data: GraphData, selId: string | null): Node[] =>
      data.nodes.map((n) => ({
        id: n.id,
        type: 'cobolNode',
        data: { ...n.data, isSelected: n.id === selId },
        position: n.position,
      })),
    []
  );

  const mapEdges = useCallback(
    (data: GraphData): Edge[] =>
      data.edges.map((e) => ({
        ...e,
        style: { stroke: '#6c5ce7', strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed' as const, color: '#6c5ce7' },
      })),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(mapNodes(graphData, selectedNodeId));
  const [edges, setEdges, onEdgesChange] = useEdgesState(mapEdges(graphData));

  // Sync nodes and edges when graphData or selection changes (via useEffect, not during render)
  useEffect(() => {
    setNodes(mapNodes(graphData, selectedNodeId));
    setEdges(mapEdges(graphData));
  }, [graphData, selectedNodeId, setNodes, setEdges, mapNodes, mapEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const fileName = (node.data as { fileName?: string }).fileName || '';
      onNodeClick(node.id, fileName);
    },
    [onNodeClick]
  );

  if (graphData.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-4">
        <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium mb-1">No Dependency Graph</p>
          <p className="text-xs text-text-muted">Upload COBOL files to visualize program dependencies</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="!bottom-4 !left-4"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2744" />
      </ReactFlow>
    </div>
  );
}
