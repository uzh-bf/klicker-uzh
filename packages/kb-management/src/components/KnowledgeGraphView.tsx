import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeGraphData,
  KnowledgeGraphNode,
  KnowledgeMetadataFieldDefinition,
  KnowledgeResourceTypeDefinition,
} from '../types.js'
import { DEFAULT_RESOURCE_TYPES, getResourceTypeDefinition } from '../utils.js'
import { MetadataChips } from './MetadataChips.js'

interface KnowledgeGraphViewProps {
  graphData?: KnowledgeGraphData
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  resourceTypes?: KnowledgeResourceTypeDefinition[]
  className?: string
}

const GRAPH_NODE_TYPES: KnowledgeResourceTypeDefinition[] = [
  {
    id: 'concept',
    label: 'Concept',
    colorClassName: 'bg-blue-50 text-blue-800',
  },
  {
    id: 'compound',
    label: 'Compound',
    colorClassName: 'bg-cyan-50 text-cyan-800',
  },
  {
    id: 'process',
    label: 'Process',
    colorClassName: 'bg-yellow-50 text-yellow-800',
  },
  {
    id: 'doc',
    label: 'Resource',
    colorClassName: 'bg-orange-50 text-orange-700',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    colorClassName: 'bg-green-50 text-green-800',
  },
]

export function KnowledgeGraphView({
  graphData,
  metadataSchema = [],
  resourceTypes = DEFAULT_RESOURCE_TYPES,
  className,
}: KnowledgeGraphViewProps) {
  const graphTypes = [...GRAPH_NODE_TYPES, ...resourceTypes]
  const nodes = useMemo(
    () => normalizeNodes(graphData?.nodes ?? []),
    [graphData?.nodes]
  )
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id)
  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]
  const edgeCount = graphData?.edges.length ?? 0

  if (!graphData || nodes.length === 0) {
    return (
      <div className={twMerge('min-h-0 flex-1 p-4 sm:p-5', className)}>
        <div className="flex h-full min-h-[440px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          No graph extracted yet.
        </div>
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'grid min-h-0 flex-1 gap-4 overflow-auto p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_270px]',
        className
      )}
    >
      <section className="relative min-h-[500px] overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          {getUsedTypes(nodes, graphTypes).map((type) => (
            <span
              key={type.id}
              className={twMerge(
                'border-current/20 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold',
                type.colorClassName ?? 'bg-slate-100 text-slate-700'
              )}
            >
              <span className="size-2 rounded-full bg-current" />
              {type.label}
            </span>
          ))}
        </div>

        <svg
          viewBox="0 0 760 520"
          className="h-full min-h-[500px] w-full"
          role="img"
          aria-label="Knowledge graph"
        >
          <rect width="760" height="520" fill="#ffffff" />
          {graphData.edges.map((edge) => {
            const source = nodes.find((node) => node.id === edge.source)
            const target = nodes.find((node) => node.id === edge.target)

            if (!source || !target) {
              return null
            }

            const selected =
              selectedNode &&
              (edge.source === selectedNode.id ||
                edge.target === selectedNode.id)

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={selected ? '#0028a5' : '#e2e8f0'}
                strokeWidth={selected ? 2.2 : 1}
              />
            )
          })}
          {nodes.map((node) => {
            const selected = node.id === selectedNode?.id
            const type = getResourceTypeDefinition(node.type, graphTypes)
            const color = getGraphColor(type.colorClassName)

            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${node.label}`}
                onClick={() => setSelectedNodeId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setSelectedNodeId(node.id)
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size ?? 14}
                  fill={selected ? '#0028a5' : color.fill}
                  stroke={color.stroke}
                  strokeWidth={selected ? 2 : 1}
                  opacity={selected ? 1 : 0.82}
                />
                <text
                  x={node.x}
                  y={(node.y ?? 0) + (node.size ?? 14) + 14}
                  textAnchor="middle"
                  className="fill-slate-700 text-[11px] font-semibold"
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="absolute bottom-3 left-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
          {nodes.length} nodes <span className="px-1">-</span> {edgeCount} edges
          {graphData.extractedByLabel && (
            <>
              <span className="px-1">-</span> {graphData.extractedByLabel}
            </>
          )}
        </div>
      </section>

      <GraphInspector
        node={selectedNode}
        graphData={graphData}
        metadataSchema={metadataSchema}
        resourceTypes={graphTypes}
      />
    </div>
  )
}

function GraphInspector({
  node,
  graphData,
  metadataSchema,
  resourceTypes,
}: {
  node?: KnowledgeGraphNode
  graphData: KnowledgeGraphData
  metadataSchema: KnowledgeMetadataFieldDefinition[]
  resourceTypes: KnowledgeResourceTypeDefinition[]
}) {
  if (!node) {
    return null
  }

  const type = getResourceTypeDefinition(node.type, resourceTypes)
  const connections = graphData.edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const otherNodeId = edge.source === node.id ? edge.target : edge.source
      const otherNode = graphData.nodes.find((item) => item.id === otherNodeId)

      return { edge, otherNode }
    })

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4">
      <div
        className={twMerge(
          'inline-flex rounded px-2 py-1 text-xs font-bold uppercase',
          type.colorClassName ?? 'bg-primary-100 text-white'
        )}
      >
        {type.label}
      </div>
      <h2 className="mt-3 text-xl font-bold text-slate-950">{node.label}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {connections.length} relations
        {node.chunkPreviews?.length
          ? ` - mentioned in ${node.chunkPreviews.length} chunks`
          : ''}
      </p>

      <section className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Connections
        </h3>
        <div className="mt-2 space-y-1">
          {connections.map(({ edge, otherNode }) => (
            <div
              key={edge.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
            >
              <span className="truncate font-semibold text-slate-800">
                {otherNode?.label ?? edge.target}
              </span>
              {edge.label && (
                <span className="shrink-0 text-[11px] italic text-slate-500">
                  {edge.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {metadataSchema.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Metadata
          </h3>
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
            <MetadataChips
              schema={metadataSchema}
              values={node.metadata}
              visibility="popover"
              maxVisible={5}
              emptyLabel="No metadata"
            />
          </div>
        </section>
      )}

      {node.chunkPreviews && node.chunkPreviews.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Source chunks
          </h3>
          <div className="mt-2 space-y-2">
            {node.chunkPreviews.map((chunk) => (
              <article
                key={chunk.id}
                className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                {chunk.content}
              </article>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}

function normalizeNodes(nodes: KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  if (nodes.length === 0) {
    return []
  }

  return nodes.map((node, index) => {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      return node
    }

    const angle = (index / nodes.length) * Math.PI * 2
    const radius = index === 0 ? 0 : 170

    return {
      ...node,
      x: 380 + Math.cos(angle) * radius,
      y: 260 + Math.sin(angle) * radius,
    }
  })
}

function getUsedTypes(
  nodes: KnowledgeGraphNode[],
  resourceTypes: KnowledgeResourceTypeDefinition[]
) {
  const seen = new Set(nodes.map((node) => node.type))

  return [...seen].map((type) => getResourceTypeDefinition(type, resourceTypes))
}

function getGraphColor(colorClassName?: string) {
  if (colorClassName?.includes('cyan')) {
    return { fill: '#cffafe', stroke: '#0891b2' }
  }

  if (colorClassName?.includes('orange')) {
    return { fill: '#ffedd5', stroke: '#ea580c' }
  }

  if (colorClassName?.includes('yellow')) {
    return { fill: '#fef3c7', stroke: '#ca8a04' }
  }

  if (colorClassName?.includes('green')) {
    return { fill: '#dcfce7', stroke: '#16a34a' }
  }

  if (colorClassName?.includes('blue')) {
    return { fill: '#dbeafe', stroke: '#0028a5' }
  }

  return { fill: '#e2e8f0', stroke: '#64748b' }
}
