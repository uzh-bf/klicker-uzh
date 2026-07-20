'use client'

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '@klicker-uzh/types'
import React from 'react'
import type { KnowledgeGraphDetailsLabels } from './knowledgeGraphLabels'

type KnowledgeGraphDetailsProps = {
  node?: KnowledgeGraphNode
  edge?: KnowledgeGraphEdge
  edgeEndpoints?: { source: string; target: string }
  isExpanding: boolean
  onClose: () => void
  onExpand: (nodeId: string) => void
  labels: KnowledgeGraphDetailsLabels
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

export function KnowledgeGraphDetails({
  node,
  edge,
  edgeEndpoints,
  isExpanding,
  onClose,
  onExpand,
  labels,
}: KnowledgeGraphDetailsProps) {
  if (node === undefined && edge === undefined) {
    return null
  }

  const heading = node?.displayLabel ?? edge?.label ?? labels.detailsFallback

  return (
    <aside
      aria-label={labels.ariaLabel}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[#E9E9E9] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:static md:z-auto md:h-full md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0 md:shadow-none"
      data-cy="knowledge-graph-details"
    >
      <div
        aria-hidden="true"
        className="mx-auto mt-2 h-1 w-12 rounded-full bg-[#A3A3A3] md:hidden"
      />
      <div className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#4C4C4C]">
              {node === undefined ? labels.relationship : labels.concept}
            </p>
            <h2 className="break-words text-lg font-semibold leading-snug text-[#121212]">
              {heading}
            </h2>
          </div>
          <button
            type="button"
            aria-label={labels.closeAriaLabel}
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E9E9E9] bg-white text-xl text-[#121212] hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {node === undefined ? null : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="font-semibold text-[#4C4C4C]">{labels.type}</dt>
                <dd className="mt-0.5 text-[#121212]">{node.kind}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#4C4C4C]">
                  {labels.connections}
                </dt>
                <dd className="mt-0.5 text-[#121212]">{node.degree}</dd>
              </div>
            </dl>

            {node.summary === undefined ? null : (
              <section aria-labelledby="knowledge-graph-summary-heading">
                <h3
                  id="knowledge-graph-summary-heading"
                  className="mb-1 text-sm font-semibold text-[#121212]"
                >
                  {labels.summary}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#4C4C4C]">
                  {node.summary}
                </p>
              </section>
            )}

            {node.content === undefined ||
            node.content === node.summary ? null : (
              <section aria-labelledby="knowledge-graph-content-heading">
                <h3
                  id="knowledge-graph-content-heading"
                  className="mb-1 text-sm font-semibold text-[#121212]"
                >
                  {labels.content}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#4C4C4C]">
                  {node.content}
                </p>
              </section>
            )}

            {node.sourceReferences.length === 0 ? null : (
              <section aria-labelledby="knowledge-graph-sources-heading">
                <h3
                  id="knowledge-graph-sources-heading"
                  className="mb-2 text-sm font-semibold text-[#121212]"
                >
                  {labels.sources}
                </h3>
                <ul className="space-y-2 text-sm text-[#4C4C4C]">
                  {node.sourceReferences.map((source) => (
                    <li
                      key={`${source.resourceId}:${source.reference ?? ''}`}
                      className="rounded border border-[#E9E9E9] px-3 py-2"
                    >
                      <span className="font-semibold text-[#121212]">
                        {source.title}
                      </span>
                      {source.reference === undefined ? null : (
                        <span className="block">{source.reference}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button
              type="button"
              onClick={() => onExpand(node.id)}
              disabled={isExpanding}
              className="min-h-11 w-full rounded-full border border-[#0028A5] bg-[#0028A5] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              data-cy="knowledge-graph-expand"
            >
              {isExpanding
                ? labels.loadingConnections
                : labels.expandConnections}
            </button>
          </div>
        )}

        {edge === undefined ? null : (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {edgeEndpoints === undefined ? null : (
                <>
                  <div>
                    <dt className="font-semibold text-[#4C4C4C]">
                      {labels.from}
                    </dt>
                    <dd className="mt-0.5 break-words text-[#121212]">
                      {edgeEndpoints.source}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#4C4C4C]">
                      {labels.to}
                    </dt>
                    <dd className="mt-0.5 break-words text-[#121212]">
                      {edgeEndpoints.target}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="font-semibold text-[#4C4C4C]">{labels.type}</dt>
                <dd className="mt-0.5 text-[#121212]">{edge.type}</dd>
              </div>
            </dl>
            <PropertyList
              properties={edge.properties}
              heading={labels.properties}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
