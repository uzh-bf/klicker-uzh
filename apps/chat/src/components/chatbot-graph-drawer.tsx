'use client'

import type { ChatbotGraphSnapshot } from '@klicker-uzh/falkordb'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type NodeProps,
} from '@xyflow/react'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Brain,
  Maximize2,
  Minimize2,
  Network,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'
import {
  mapGraphSnapshotToFlow,
  type ChatbotGraphFlow,
  type ChatbotGraphFlowNode,
} from '../lib/graph/flow'

type ChatbotGraphDrawerProps = {
  chatbotId: string
  onOpenChange: (open: boolean) => void
  open: boolean
}

type LoadState =
  | { status: 'idle' | 'loading'; snapshot?: undefined; error?: undefined }
  | { status: 'loaded'; snapshot: ChatbotGraphSnapshot; error?: undefined }
  | { status: 'error'; snapshot?: undefined; error: string }

const nodeTypes = {
  concept: ConceptGraphNode,
}

export function ChatbotGraphDrawer({
  chatbotId,
  onOpenChange,
  open,
}: ChatbotGraphDrawerProps) {
  const [loadState, setLoadState] = React.useState<LoadState>({
    status: 'idle',
  })
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [portalElement, setPortalElement] = React.useState<HTMLElement | null>(
    null
  )
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>()

  const loadGraph = React.useCallback(async () => {
    setLoadState({ status: 'loading' })

    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/graph`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to load knowledge graph'
        throw new Error(message)
      }

      setLoadState({
        status: 'loaded',
        snapshot: payload as ChatbotGraphSnapshot,
      })
      setSelectedNodeId((currentNodeId) => {
        const snapshot = payload as ChatbotGraphSnapshot
        return currentNodeId &&
          snapshot.nodes.some((node) => node.id === currentNodeId)
          ? currentNodeId
          : undefined
      })
    } catch (error) {
      setLoadState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [chatbotId])

  React.useEffect(() => {
    if (open) {
      void loadGraph()
    }
  }, [loadGraph, open])

  React.useEffect(() => {
    setPortalElement(document.body)
  }, [])

  const snapshot =
    loadState.status === 'loaded' ? loadState.snapshot : undefined
  const flow = React.useMemo<ChatbotGraphFlow>(() => {
    return snapshot
      ? mapGraphSnapshotToFlow(snapshot, { selectedNodeId })
      : { edges: [], nodes: [] }
  }, [selectedNodeId, snapshot])
  const selectedNode =
    snapshot && selectedNodeId
      ? getSelectedNode(snapshot, selectedNodeId)
      : undefined
  const relatedConcepts =
    snapshot && selectedNode
      ? getRelatedConcepts(snapshot, selectedNode.id)
      : []

  if (!open || !portalElement) {
    return null
  }

  return createPortal(
    <>
      <button
        aria-label="Close knowledge graph"
        className="fixed inset-0 z-[1000] cursor-default bg-black/20"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <aside
        className={twMerge(
          'bg-background fixed right-0 z-[1010] flex w-full flex-col overflow-hidden border-l shadow-2xl transition-all duration-200',
          isExpanded
            ? 'inset-3 rounded-lg border sm:inset-5'
            : 'inset-y-0 sm:max-w-md lg:max-w-lg'
        )}
      >
        <header className="flex min-h-12 items-center gap-2 border-b px-4">
          <div className="flex min-w-0 items-stretch gap-1 self-stretch">
            <button
              className="text-muted-foreground inline-flex items-center gap-1.5 border-b-2 border-transparent px-1 text-xs font-semibold transition-colors"
              disabled
              type="button"
            >
              <Brain className="size-3.5" />
              Gedächtnis
            </button>
            <button
              className="text-uzh-blue inline-flex items-center gap-1.5 border-b-2 border-current px-1 text-xs font-semibold transition-colors"
              type="button"
            >
              <Network className="size-3.5" />
              Konzeptgraph
            </button>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex size-8 items-center justify-center rounded-md transition-colors"
            onClick={loadGraph}
            type="button"
          >
            <RefreshCw
              className={twMerge(
                'size-4',
                loadState.status === 'loading' && 'animate-spin'
              )}
            />
            <span className="sr-only">Refresh knowledge graph</span>
          </button>
          <button
            className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
            onClick={() => setIsExpanded((value) => !value)}
            type="button"
          >
            {isExpanded ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
            <span className="sr-only">
              {isExpanded ? 'Exit full screen' : 'Full screen'}
            </span>
          </button>
          <button
            className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="size-4" />
            <span className="sr-only">Close knowledge graph</span>
          </button>
        </header>

        {loadState.status === 'loading' || loadState.status === 'idle' ? (
          <CenteredState>
            <RefreshCw className="text-muted-foreground size-5 animate-spin" />
            <span className="text-muted-foreground text-sm">Loading graph</span>
          </CenteredState>
        ) : loadState.status === 'error' ? (
          <CenteredState>
            <AlertCircle className="text-destructive size-5" />
            <span className="text-muted-foreground max-w-sm text-center text-sm">
              {loadState.error}
            </span>
          </CenteredState>
        ) : !snapshot || snapshot.nodes.length === 0 ? (
          <CenteredState>
            <span className="text-muted-foreground text-sm">
              No graph data available
            </span>
          </CenteredState>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-[#f8fafc]">
            <GraphLegend />
            <div className="relative min-h-0 flex-1">
              {snapshot.truncated && (
                <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                  Showing the first {snapshot.limits.nodeLimit} nodes and{' '}
                  {snapshot.limits.edgeLimit} relationships.
                </div>
              )}
              <ReactFlow
                className="h-full w-full"
                edges={flow.edges}
                edgesFocusable={false}
                fitView
                fitViewOptions={{ padding: 0.16 }}
                maxZoom={1.45}
                minZoom={0.28}
                nodeTypes={nodeTypes}
                nodes={flow.nodes}
                nodesConnectable={false}
                nodesDraggable={false}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                panOnScroll
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#e2e8f0" gap={28} />
                <Controls position="bottom-left" showInteractive={false} />
              </ReactFlow>
            </div>
            {selectedNode && (
              <ConceptDetailPanel
                onBack={() => setSelectedNodeId(undefined)}
                onSelectNode={setSelectedNodeId}
                relatedConcepts={relatedConcepts}
                selectedNode={selectedNode}
              />
            )}
          </div>
        )}
      </aside>
    </>,
    portalElement
  )
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
      {children}
    </div>
  )
}

function GraphLegend() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-white/95 px-4 py-2 text-[10px] font-semibold text-slate-600">
      <LegendDot color="#0028a5" label="Domäne" />
      <LegendDot color="#1d4ed8" label="Thema" />
      <LegendDot color="#0f3fbd" label="Begriff" />
      <LegendDot color="#67e8f9" label="Formel" />
      <LegendDot color="#10b981" label="Beispiel" />
      <LegendDot color="#f43f5e" label="Annahme" />
      <LegendDot color="#7c3aed" label="Erklärung" />
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-5 bg-[#2563eb]" />
        Hierarchie
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-5 border-t border-dashed border-[#2563eb]" />
        Abhängigkeit
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-5 bg-[#0f766e]" />
        Fokusbeziehung
      </span>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

function ConceptGraphNode({ data }: NodeProps<ChatbotGraphFlowNode>) {
  const circleClass = getCircleClass(data)

  return (
    <div
      className={twMerge(
        'group relative flex items-center justify-center text-center transition-opacity',
        circleClass,
        data.isDimmed && 'opacity-35'
      )}
    >
      <Handle
        className="pointer-events-none opacity-0"
        position={Position.Top}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        type="target"
      />
      <div
        className={twMerge(
          'flex size-full items-center justify-center rounded-full border-2 bg-white shadow-md ring-white transition-all',
          data.isSelected || data.kind === 'domain'
            ? 'border-slate-950 ring-4'
            : data.isRelated || data.kind === 'topic'
              ? 'border-slate-800 ring-2'
              : 'border-transparent ring-1'
        )}
        style={{
          backgroundColor: data.isSelected ? '#0028a5' : data.accent,
          borderColor: data.isSelected
            ? '#020617'
            : data.isRelated
              ? '#0f172a'
              : data.accent,
        }}
      >
        {data.kind === 'formula' ? (
          <span className="text-[10px] font-bold text-white">f(x)</span>
        ) : data.kind === 'example' ? (
          <Sparkles className="size-4 text-white" />
        ) : (
          <span className="size-2 rounded-full bg-white/80" />
        )}
      </div>
      <div
        className={twMerge(
          'absolute left-1/2 top-[calc(100%+0.25rem)] w-32 -translate-x-1/2 rounded-sm bg-[#f8fafc]/90 px-1 py-0.5 text-[11px] font-semibold leading-tight text-slate-700',
          data.isSelected && 'text-slate-950'
        )}
      >
        {data.label}
      </div>
      <Handle
        className="pointer-events-none opacity-0"
        position={Position.Top}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        type="source"
      />
    </div>
  )
}

function getCircleClass(data: ChatbotGraphFlowNode['data']) {
  if (data.isSelected || data.kind === 'domain') return 'size-14'
  if (data.isRelated || data.kind === 'topic') return 'size-11'
  if (data.kind === 'concept') return 'size-9'

  return 'size-8'
}

function ConceptDetailPanel({
  onBack,
  onSelectNode,
  relatedConcepts,
  selectedNode,
}: {
  onBack: () => void
  onSelectNode: (nodeId: string) => void
  relatedConcepts: ChatbotGraphSnapshot['nodes']
  selectedNode: ChatbotGraphSnapshot['nodes'][number]
}) {
  return (
    <section className="max-h-[44dvh] shrink-0 overflow-y-auto border-t bg-white px-5 py-4 shadow-[0_-12px_35px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-center gap-3">
        <button
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          Zurück
        </button>
        <div className="min-w-0 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Konzept · {selectedNode.kind ?? 'Begriff'}
        </div>
      </div>
      <h3 className="text-base font-bold text-slate-950">
        {selectedNode.label}
      </h3>
      {selectedNode.summary && (
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {selectedNode.summary}
        </p>
      )}
      {selectedNode.formula && (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
          {selectedNode.formula}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="bg-uzh-blue hover:bg-uzh-blue-80 inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors"
          type="button"
        >
          <Zap className="size-3.5" />
          Im Chat erklären
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          type="button"
        >
          <BookOpen className="size-3.5" />
          Im Buch nachschlagen
        </button>
      </div>
      {relatedConcepts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Verwandte Begriffe · {relatedConcepts.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {relatedConcepts.map((concept) => (
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
                key={concept.id}
                onClick={() => onSelectNode(concept.id)}
                type="button"
              >
                <span className="bg-uzh-blue size-1.5 rounded-full" />
                {concept.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function getSelectedNode(
  snapshot: ChatbotGraphSnapshot,
  selectedNodeId: string | undefined
) {
  if (selectedNodeId) {
    const selectedNode = snapshot.nodes.find(
      (node) => node.id === selectedNodeId
    )
    if (selectedNode) return selectedNode
  }

  return undefined
}

function getRelatedConcepts(
  snapshot: ChatbotGraphSnapshot,
  selectedNodeId: string
) {
  const relatedNodeIds = new Set<string>()

  for (const edge of snapshot.edges) {
    if (edge.source === selectedNodeId) relatedNodeIds.add(edge.target)
    if (edge.target === selectedNodeId) relatedNodeIds.add(edge.source)
  }

  return snapshot.nodes
    .filter((node) => relatedNodeIds.has(node.id))
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, 8)
}
