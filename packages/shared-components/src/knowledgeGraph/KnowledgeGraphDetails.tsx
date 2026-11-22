'use client'

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphSourceReference,
} from '@klicker-uzh/types'
import React from 'react'
import type { KnowledgeGraphDetailsLabels } from './knowledgeGraphLabels'
import {
  conceptDefinition,
  isSymmetricRelationType,
  type KnowledgeGraphAskSelection,
  readableDescription,
  relationshipDisplayLabel,
} from './knowledgeGraphView'

const SIDEBAR_LAYOUT_CLASSES =
  'fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[#E9E9E9] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:!relative md:z-auto md:h-full md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0 md:shadow-none'

// A compact host overlays the pane inside the graph, so the canvas keeps its
// full width and the loaded concept and relationship lists stay reachable.
const CONTAINED_LAYOUT_CLASSES =
  'absolute inset-x-0 bottom-0 z-30 max-h-[55%] overflow-y-auto rounded-t-2xl border border-[#E9E9E9] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]'

// Compact pills sized to their label; full-width buttons crowded the sheet.
const ACTION_CLASSES =
  'min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2'

type KnowledgeGraphDetailsProps = {
  node?: KnowledgeGraphNode
  edge?: KnowledgeGraphEdge
  edgeEndpoints?: { source: string; target: string }
  isExpanding: boolean
  /** Every connection of the selected concept is already on the canvas. */
  allConnectionsShown?: boolean
  onClose: () => void
  onExpand: (nodeId: string) => void
  /** Starts practice on the selection; absent when the host has no quiz. */
  onQuiz?: (selection: KnowledgeGraphAskSelection) => void
  labels: KnowledgeGraphDetailsLabels
  /** Emits the bounded ask payload; the control renders only when provided. */
  askSelection?: KnowledgeGraphAskSelection
  onAsk?: (selection: KnowledgeGraphAskSelection) => void
  /** 'contained' overlays the pane inside the graph instead of a side column. */
  layout?: 'sidebar' | 'contained'
}

function PropertyList({
  properties,
  heading,
}: {
  properties: Record<string, string | number | boolean>
  heading: string
}) {
  const entries = Object.entries(properties)
  if (entries.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="knowledge-graph-properties-heading">
      <h3
        id="knowledge-graph-properties-heading"
        className="mb-2 text-sm font-semibold text-[#121212]"
      >
        {heading}
      </h3>
      <dl className="space-y-2 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded bg-[#FAFAFA] px-3 py-2">
            <dt className="break-words font-semibold text-[#4C4C4C]">{key}</dt>
            <dd className="mt-0.5 break-words text-[#121212]">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function SourceList({
  sources,
  heading,
  pages,
}: {
  sources: KnowledgeGraphSourceReference[]
  heading: string
  pages: KnowledgeGraphDetailsLabels['pages']
}) {
  if (sources.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="knowledge-graph-sources-heading">
      <h3
        id="knowledge-graph-sources-heading"
        className="mb-2 text-sm font-semibold text-[#121212]"
      >
        {heading}
      </h3>
      <ul className="space-y-2 text-sm text-[#4C4C4C]">
        {sources.map((source) => {
          const reference =
            source.pages === undefined ? source.reference : pages(source.pages)
          return (
            <li
              key={`${source.resourceId}:${source.reference ?? ''}`}
              className="rounded border border-[#E9E9E9] px-3 py-2"
            >
              <span className="font-semibold text-[#121212]">
                {source.title}
              </span>
              {reference === undefined ? null : (
                <span className="block">{reference}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function EdgeEndpoints({
  edge,
  endpoints,
  labels,
}: {
  edge: KnowledgeGraphEdge
  endpoints: { source: string; target: string }
  labels: KnowledgeGraphDetailsLabels
}) {
  if (isSymmetricRelationType(edge.relationType)) {
    return (
      <div>
        <dt className="font-semibold text-[#4C4C4C]">{labels.concepts}</dt>
        <dd className="mt-0.5 break-words text-[#121212]">
          {endpoints.source}, {endpoints.target}
        </dd>
      </div>
    )
  }

  return (
    <>
      <div>
        <dt className="font-semibold text-[#4C4C4C]">{labels.from}</dt>
        <dd className="mt-0.5 break-words text-[#121212]">
          {endpoints.source}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-[#4C4C4C]">{labels.to}</dt>
        <dd className="mt-0.5 break-words text-[#121212]">
          {endpoints.target}
        </dd>
      </div>
    </>
  )
}

export function KnowledgeGraphDetails({
  node,
  edge,
  edgeEndpoints,
  isExpanding,
  allConnectionsShown = false,
  onClose,
  onExpand,
  labels,
  askSelection,
  onAsk,
  onQuiz,
  layout = 'sidebar',
}: KnowledgeGraphDetailsProps) {
  if (node === undefined && edge === undefined) {
    return null
  }

  const heading =
    node?.displayLabel ??
    (edge === undefined
      ? undefined
      : relationshipDisplayLabel(edge, labels.relationTypes)) ??
    labels.detailsFallback
  const definition = node === undefined ? undefined : conceptDefinition(node)
  const layoutClasses =
    layout === 'contained' ? CONTAINED_LAYOUT_CLASSES : SIDEBAR_LAYOUT_CLASSES

  return (
    <aside
      aria-label={labels.ariaLabel}
      className={layoutClasses}
      data-cy="knowledge-graph-details"
    >
      <div
        aria-hidden="true"
        className="mx-auto mt-2 h-1 w-12 rounded-full bg-[#A3A3A3] md:hidden"
      />
      <div className={layout === 'contained' ? 'p-3' : 'p-5'}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#4C4C4C]">
              {node === undefined ? labels.relationship : labels.concept}
            </p>
            <h2 className="break-words text-lg font-semibold leading-snug text-[#121212]">
              {heading}
            </h2>
            {definition === undefined ? null : (
              <p
                className="mt-1 text-sm leading-6 text-[#4C4C4C]"
                data-cy="knowledge-graph-definition"
              >
                {definition}
              </p>
            )}
          </div>
          <button
            type="button"
            data-cy="knowledge-graph-close"
            aria-label={labels.closeAriaLabel}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E9E9E9] bg-white text-lg text-[#121212] hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {onAsk === undefined || askSelection === undefined ? null : (
            <button
              type="button"
              data-cy="knowledge-graph-ask"
              onClick={() => onAsk(askSelection)}
              className={`${ACTION_CLASSES} border-[#0028A5] bg-white text-[#0028A5] hover:bg-[#F5F5FB]`}
            >
              {labels.ask}
            </button>
          )}
          {onQuiz === undefined || askSelection === undefined ? null : (
            <button
              type="button"
              data-cy="knowledge-graph-quiz"
              onClick={() => onQuiz(askSelection)}
              className={`${ACTION_CLASSES} border-[#0028A5] bg-white text-[#0028A5] hover:bg-[#F5F5FB]`}
            >
              {labels.quiz}
            </button>
          )}
          {node === undefined ? null : (
            <button
              type="button"
              onClick={() => onExpand(node.id)}
              disabled={isExpanding || allConnectionsShown}
              className={`${ACTION_CLASSES} border-[#0028A5] bg-[#0028A5] text-white hover:opacity-90 disabled:cursor-default disabled:opacity-60`}
              data-cy="knowledge-graph-expand"
            >
              {isExpanding
                ? labels.loadingConnections
                : allConnectionsShown
                  ? labels.allConnectionsShown
                  : labels.expandConnections}
            </button>
          )}
        </div>

        {node === undefined ? null : (
          <div className="space-y-4">
            <p className="text-xs text-[#4C4C4C]">
              {labels.type}: <span className="text-[#121212]">{node.kind}</span>
              {' · '}
              {labels.connections}:{' '}
              <span className="text-[#121212]">{node.degree}</span>
            </p>

            {node.summary === undefined ||
            node.summary === definition ? null : (
              <section aria-labelledby="knowledge-graph-summary-heading">
                <h3
                  id="knowledge-graph-summary-heading"
                  className="mb-1 text-sm font-semibold text-[#121212]"
                >
                  {labels.summary}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#4C4C4C]">
                  {readableDescription(node.summary)}
                </p>
              </section>
            )}

            {node.content === undefined ||
            node.content === node.summary ||
            node.content === definition ? null : (
              <section aria-labelledby="knowledge-graph-content-heading">
                <h3
                  id="knowledge-graph-content-heading"
                  className="mb-1 text-sm font-semibold text-[#121212]"
                >
                  {labels.content}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#4C4C4C]">
                  {readableDescription(node.content)}
                </p>
              </section>
            )}

            <SourceList
              sources={node.sourceReferences}
              heading={labels.sources}
              pages={labels.pages}
            />
          </div>
        )}

        {edge === undefined ? null : (
          <div className="space-y-4">
            {edgeEndpoints === undefined ? null : (
              // The relation read as one proposition, so it can be checked
              // against its sources at a glance.
              <p
                className="text-sm leading-6 text-[#121212]"
                data-cy="knowledge-graph-relation-sentence"
              >
                <strong>{edgeEndpoints.source}</strong>
                {isSymmetricRelationType(edge.relationType) ? (
                  <>
                    {' ↔ '}
                    <strong>{edgeEndpoints.target}</strong> (<em>{heading}</em>)
                  </>
                ) : (
                  <>
                    {' — '}
                    <em>{heading}</em>
                    {' → '}
                    <strong>{edgeEndpoints.target}</strong>
                  </>
                )}
              </p>
            )}
            {edge.sourceReferences.length > 0 ? null : (
              <p
                className="rounded-md border border-dashed border-[#A3A3A3] px-2 py-1 text-xs text-[#4C4C4C]"
                data-cy="knowledge-graph-inferred-relation"
              >
                {labels.inferredRelation}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {edgeEndpoints === undefined ? null : (
                <EdgeEndpoints
                  edge={edge}
                  endpoints={edgeEndpoints}
                  labels={labels}
                />
              )}
              <div>
                <dt className="font-semibold text-[#4C4C4C]">{labels.type}</dt>
                <dd className="mt-0.5 text-[#121212]">
                  {labels.relationTypes[edge.relationType]}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#4C4C4C]">
                  {labels.evidence}
                </dt>
                <dd className="mt-0.5 text-[#121212]">
                  {labels.relationStatuses[edge.relationStatus]}
                </dd>
              </div>
            </dl>
            <SourceList
              sources={edge.sourceReferences}
              heading={labels.sources}
              pages={labels.pages}
            />
            <PropertyList
              properties={edge.properties}
              heading={labels.properties}
            />
          </div>
        )}
        <p
          className="mt-4 text-xs text-[#4C4C4C]"
          data-cy="knowledge-graph-ai-note"
        >
          {labels.aiGeneratedNote}
        </p>
      </div>
    </aside>
  )
}
