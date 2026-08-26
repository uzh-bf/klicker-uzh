'use client'

import {
  ApolloError,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client'
import type {
  GetKbKnowledgeGraphNeighborsQuery,
  GetKbKnowledgeGraphOverviewQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  GetKbKnowledgeGraphConfigDocument,
  GetKbKnowledgeGraphNeighborsDocument,
  GetKbKnowledgeGraphOverviewDocument,
  KbGraphBuildStatus,
  KbGraphQualityTier,
  RebuildKbKnowledgeGraphDocument,
  SearchKbKnowledgeGraphDocument,
} from '@klicker-uzh/graphql/dist/ops'
import type { KnowledgeGraphDataSource } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import { KnowledgeGraphUnavailableError } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { Badge, Button, H3, SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'

const KnowledgeGraphViewer = dynamic(
  () =>
    import(
      '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
    ).then((module) => module.KnowledgeGraphViewer),
  { ssr: false }
)

type GraphResponse =
  | GetKbKnowledgeGraphOverviewQuery['getKbKnowledgeGraphOverview']
  | GetKbKnowledgeGraphNeighborsQuery['getKbKnowledgeGraphNeighbors']

function toKnowledgeGraphResponse(
  response: GraphResponse
): KnowledgeGraphResponse {
  return {
    kbId: response.kbId,
    buildId: response.buildId,
    isStale: response.isStale,
    truncated: response.truncated,
    nodes: response.nodes.map((node) => ({
      id: node.id,
      labels: node.labels,
      kind: node.kind,
      displayLabel: node.displayLabel,
      ...(node.summary == null ? {} : { summary: node.summary }),
      ...(node.content == null ? {} : { content: node.content }),
      degree: node.degree,
      sourceReferences: node.sourceReferences.map((source) => ({
        resourceId: source.resourceId,
        title: source.title,
        ...(source.reference == null ? {} : { reference: source.reference }),
      })),
    })),
    edges: response.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      properties: edge.properties as Record<string, string | number | boolean>,
    })),
  }
}

function normalizeGraphError(error: unknown): never {
  if (
    error instanceof ApolloError &&
    error.graphQLErrors.some((graphQLError) =>
      String(graphQLError.extensions?.code ?? '').startsWith('KB_GRAPH_')
    )
  ) {
    throw new KnowledgeGraphUnavailableError()
  }

  throw error
}

type KnowledgeGraphStatusLabels = {
  empty: string
  queued: string
  processing: string
  succeeded: string
  failed: string
}

function statusLabel(
  status: KbGraphBuildStatus | null | undefined,
  labels: KnowledgeGraphStatusLabels
) {
  switch (status) {
    case KbGraphBuildStatus.Queued:
      return labels.queued
    case KbGraphBuildStatus.Processing:
      return labels.processing
    case KbGraphBuildStatus.Succeeded:
      return labels.succeeded
    case KbGraphBuildStatus.Failed:
      return labels.failed
    default:
      return labels.empty
  }
}

function KnowledgeGraphPreview({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const apolloClient = useApolloClient()
  const dataSource = useMemo<KnowledgeGraphDataSource>(
    () => ({
      overview: async () => {
        try {
          const { data } = await apolloClient.query({
            query: GetKbKnowledgeGraphOverviewDocument,
            variables: { kbId },
            fetchPolicy: 'network-only',
          })
          return toKnowledgeGraphResponse(data.getKbKnowledgeGraphOverview)
        } catch (error) {
          return normalizeGraphError(error)
        }
      },
      search: async (query) => {
        try {
          const { data } = await apolloClient.query({
            query: SearchKbKnowledgeGraphDocument,
            variables: { kbId, query },
            fetchPolicy: 'network-only',
          })
          return toKnowledgeGraphResponse(data.searchKbKnowledgeGraph)
        } catch (error) {
          return normalizeGraphError(error)
        }
      },
      neighbors: async (nodeId) => {
        try {
          const { data } = await apolloClient.query({
            query: GetKbKnowledgeGraphNeighborsDocument,
            variables: { kbId, nodeId },
            fetchPolicy: 'network-only',
          })
          return toKnowledgeGraphResponse(data.getKbKnowledgeGraphNeighbors)
        } catch (error) {
          return normalizeGraphError(error)
        }
      },
    }),
    [apolloClient, kbId]
  )

  return (
    <div data-cy="kb-knowledge-graph-preview">
      <KnowledgeGraphViewer
        dataSource={dataSource}
        unavailableMessage={t('kb.graphPreviewUnavailable')}
        className="!h-[42rem]"
      />
    </div>
  )
}

function KnowledgeGraphPanel({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const [selectedTier, setSelectedTier] = useState<KbGraphQualityTier>(
    KbGraphQualityTier.Standard
  )
  const [operationError, setOperationError] = useState<string | null>(null)
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    GetKbKnowledgeGraphConfigDocument,
    {
      variables: { kbId },
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    }
  )
  const [rebuildGraph, { loading: isRebuilding }] = useMutation(
    RebuildKbKnowledgeGraphDocument
  )
  const config = data?.getKbKnowledgeGraphConfig
  const isActive =
    config?.status === KbGraphBuildStatus.Queued ||
    config?.status === KbGraphBuildStatus.Processing
  const hasPublishedGraph = config?.publishedBuildId != null

  useEffect(() => {
    if (config?.qualityTier != null && !isActive) {
      setSelectedTier(config.qualityTier)
    }
  }, [config?.qualityTier, isActive])

  useEffect(() => {
    if (isActive) {
      startPolling(30_000)
    } else {
      stopPolling()
    }
    return stopPolling
  }, [isActive, startPolling, stopPolling])

  const tierItems = [
    {
      value: KbGraphQualityTier.Standard,
      label: t('kb.graphQualityStandard'),
    },
    {
      value: KbGraphQualityTier.High,
      label: t('kb.graphQualityHigh'),
    },
  ]
  const statusLabels: KnowledgeGraphStatusLabels = {
    empty: t('kb.graphStatusEmpty'),
    queued: t('kb.graphStatusQueued'),
    processing: t('kb.graphStatusProcessing'),
    succeeded: t('kb.graphStatusSucceeded'),
    failed: t('kb.graphStatusFailed'),
  }

  const handleRebuild = async () => {
    if (isRebuilding || isActive) return

    setOperationError(null)
    try {
      await rebuildGraph({
        variables: { kbId, qualityTier: selectedTier },
      })
      await refetch()
    } catch (mutationError) {
      console.error('Failed to rebuild KB knowledge graph', { kbId })
      setOperationError(t('kb.graphBuildError'))
    }
  }

  return (
    <section
      className="mt-6 space-y-4 border-t border-gray-200 pt-6"
      data-cy="kb-knowledge-graph-panel"
    >
      <div>
        <H3>{t('kb.graphTitle')}</H3>
        <p className="mt-1 text-sm text-slate-600">
          {t('kb.graphDescription')}
        </p>
      </div>

      {loading && data === undefined ? (
        <p className="text-sm text-slate-600" role="status">
          {t('kb.graphLoading')}
        </p>
      ) : error || config === undefined ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950"
          role="alert"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('kb.graphLoadError')}</span>
            <Button
              onClick={() => void refetch()}
              data={{ cy: 'kb-knowledge-graph-config-retry' }}
            >
              <Button.Label>{t('kb.graphRetry')}</Button.Label>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <SelectField
                label={t('kb.graphQualityTierLabel')}
                items={tierItems}
                value={selectedTier}
                onChange={(value) =>
                  setSelectedTier(value as KbGraphQualityTier)
                }
                disabled={isActive || isRebuilding}
                data={{ cy: 'kb-knowledge-graph-quality-tier' }}
              />
              <Button
                primary
                loading={isRebuilding}
                disabled={isActive}
                onClick={() => void handleRebuild()}
                data={{ cy: 'kb-knowledge-graph-rebuild' }}
              >
                <Button.Label>
                  {hasPublishedGraph
                    ? t('kb.graphRebuild')
                    : t('kb.graphBuild')}
                </Button.Label>
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t('kb.graphBuildCost')}
            </p>
            <div
              className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm"
              aria-live="polite"
              aria-atomic="true"
              data-cy="kb-knowledge-graph-status"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">
                  {t('kb.graphStatusLabel')}:
                </span>
                <Badge variant="outline">
                  {statusLabel(config.status, statusLabels)}
                </Badge>
                {config.isStale && hasPublishedGraph ? (
                  <Badge variant="outline">{t('kb.graphStale')}</Badge>
                ) : null}
              </div>
              {config.statusMessage ? (
                <p className="text-slate-600">{config.statusMessage}</p>
              ) : null}
              {config.buildId ? (
                <p className="break-all text-xs text-slate-500">
                  {t('kb.graphBuildId', { buildId: config.buildId })}
                </p>
              ) : null}
            </div>
          </div>

          {operationError ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950"
              role="alert"
            >
              {operationError}
            </p>
          ) : null}

          <div>
            <h4 className="mb-2 font-semibold text-slate-900">
              {t('kb.graphPreviewTitle')}
            </h4>
            {hasPublishedGraph ? (
              <KnowledgeGraphPreview kbId={kbId} />
            ) : (
              <div
                className="rounded-lg border border-dashed border-slate-400 bg-slate-50 p-6 text-center text-sm text-slate-600"
                data-cy="kb-knowledge-graph-preview-unavailable"
              >
                {t('kb.graphPreviewUnavailable')}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default KnowledgeGraphPanel
