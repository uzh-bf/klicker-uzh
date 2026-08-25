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
  KbGraphCostStatus,
  KbGraphQualityTier,
  RebuildKbKnowledgeGraphDocument,
  SearchKbKnowledgeGraphDocument,
  SetKbKnowledgeGraphEnabledDocument,
} from '@klicker-uzh/graphql/dist/ops'
import type { KnowledgeGraphDataSource } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import { KnowledgeGraphUnavailableError } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { Badge, Button, SelectField, Switch } from '@uzh-bf/design-system'
import dynamic from 'next/dynamic'
import { useFormatter, useTranslations } from 'next-intl'
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

type KnowledgeGraphCostStatusLabels = {
  reserved: string
  settled: string
  released: string
  needsHumanReview: string
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

function costStatusLabel(
  status: KbGraphCostStatus | null | undefined,
  labels: KnowledgeGraphCostStatusLabels
) {
  switch (status) {
    case KbGraphCostStatus.Reserved:
      return labels.reserved
    case KbGraphCostStatus.Settled:
      return labels.settled
    case KbGraphCostStatus.Released:
      return labels.released
    case KbGraphCostStatus.NeedsHumanReview:
      return labels.needsHumanReview
    default:
      return '—'
  }
}

function formatMinorUnits(
  format: ReturnType<typeof useFormatter>,
  amountMinorUnits: number | null | undefined,
  currency: string | null | undefined
) {
  if (amountMinorUnits == null || currency == null) return '—'
  return format.number(amountMinorUnits / 100, {
    style: 'currency',
    currency,
  })
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
  const format = useFormatter()
  const [selectedTier, setSelectedTier] = useState<KbGraphQualityTier>(
    KbGraphQualityTier.Standard
  )
  const [operationError, setOperationError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
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
  const [setGraphEnabled, { loading: isTogglingEnabled }] = useMutation(
    SetKbKnowledgeGraphEnabledDocument
  )
  const config = data?.getKbKnowledgeGraphConfig
  const formattedBillingLabel =
    config?.billingLabel === 'SEMESTER_QUOTA'
      ? t('kb.graphBillingSemesterQuota')
      : config?.billingLabel === 'PROVIDER_BILLED'
        ? t('kb.graphBillingProvider')
        : '—'
  const isActive =
    config?.status === KbGraphBuildStatus.Queued ||
    config?.status === KbGraphBuildStatus.Processing
  const hasPublishedGraph = config?.publishedBuildId != null
  const selectedEstimate =
    selectedTier === KbGraphQualityTier.High
      ? config?.highEstimateMinorUnits
      : config?.standardEstimateMinorUnits
  const formattedSelectedEstimate = formatMinorUnits(
    format,
    selectedEstimate,
    config?.quotaCurrency
  )

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
  const costStatusLabels: KnowledgeGraphCostStatusLabels = {
    reserved: t('kb.graphCostStatusReserved'),
    settled: t('kb.graphCostStatusSettled'),
    released: t('kb.graphCostStatusReleased'),
    needsHumanReview: t('kb.graphCostStatusNeedsHumanReview'),
  }
  let graphSummary: string
  if (loading && data === undefined) {
    graphSummary = t('kb.graphLoading')
  } else if (error || config === undefined) {
    graphSummary = t('kb.graphLoadError')
  } else {
    graphSummary = [
      `${t('kb.graphStatusLabel')}: ${statusLabel(config.status, statusLabels)}`,
      config.isStale && hasPublishedGraph ? t('kb.graphStale') : null,
      config.costStatus === KbGraphCostStatus.NeedsHumanReview
        ? costStatusLabel(config.costStatus, costStatusLabels)
        : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' · ')
  }

  const handleRebuild = async () => {
    if (isRebuilding || isActive || !config?.isEnabled) return

    setOperationError(null)
    try {
      await rebuildGraph({
        variables: { kbId, qualityTier: selectedTier },
      })
      await refetch()
    } catch {
      console.error('Failed to rebuild KB knowledge graph', { kbId })
      setOperationError(t('kb.graphBuildError'))
    }
  }

  const handleEnabledChange = async (enabled: boolean) => {
    setOperationError(null)
    try {
      await setGraphEnabled({ variables: { kbId, enabled } })
      try {
        await refetch()
      } catch {
        console.warn('Failed to refresh KB knowledge graph opt-in', { kbId })
      }
    } catch {
      console.error('Failed to update KB knowledge graph opt-in', { kbId })
      setOperationError(t('kb.graphEnableError'))
    }
  }

  return (
    <details
      className="mt-4"
      data-cy="kb-graph-settings"
      onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2">
        <h2 className="font-semibold text-slate-900">{t('kb.graphTitle')}</h2>
        <span
          className="text-sm text-slate-600"
          aria-live="polite"
          data-cy="kb-graph-summary-status"
        >
          {graphSummary}
        </span>
        <span className="text-sm font-medium text-primary-100">
          {t('kb.configure')}
        </span>
      </summary>
      <section className="mt-3 space-y-4" data-cy="kb-knowledge-graph-panel">
        <p className="text-sm text-slate-600">{t('kb.graphDescription')}</p>

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
              <Switch
                size="sm"
                label={t('kb.graphEnableLabel')}
                className={{ label: 'min-w-0 whitespace-normal' }}
                checked={config.isEnabled}
                onCheckedChange={(enabled) => void handleEnabledChange(enabled)}
                disabled={isTogglingEnabled}
                data={{ cy: 'kb-knowledge-graph-enabled' }}
              />
              <p className="mt-2 text-xs text-slate-500">
                {config.isEnabled
                  ? t('kb.graphEnabledDescription')
                  : t('kb.graphDisabledDescription')}
              </p>
              {!config.costConfigurationReady ? (
                <p
                  className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                  data-cy="kb-knowledge-graph-cost-unconfigured"
                >
                  {t('kb.graphCostUnavailable')}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <SelectField
                  label={t('kb.graphQualityTierLabel')}
                  items={tierItems}
                  value={selectedTier}
                  onChange={(value) =>
                    setSelectedTier(value as KbGraphQualityTier)
                  }
                  disabled={
                    isActive ||
                    isRebuilding ||
                    !config.isEnabled ||
                    !config.costConfigurationReady
                  }
                  data={{ cy: 'kb-knowledge-graph-quality-tier' }}
                />
                <Button
                  primary
                  loading={isRebuilding}
                  disabled={
                    isActive ||
                    !config.isEnabled ||
                    !config.costConfigurationReady
                  }
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
                {t('kb.graphBuildCost', { amount: formattedSelectedEstimate })}
              </p>
              <div
                className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-sm text-slate-700 sm:grid-cols-2"
                data-cy="kb-knowledge-graph-cost"
              >
                <p>
                  <span className="font-semibold">
                    {t('kb.graphBillingLabel')}:
                  </span>{' '}
                  {formattedBillingLabel}
                </p>
                <p>
                  <span className="font-semibold">
                    {t('kb.graphRemainingQuota')}:
                  </span>{' '}
                  {formatMinorUnits(
                    format,
                    config.remainingSemesterQuotaMinorUnits,
                    config.quotaCurrency
                  )}
                </p>
                <p>
                  <span className="font-semibold">
                    {t('kb.graphWorstCaseBalance')}:
                  </span>{' '}
                  {formatMinorUnits(
                    format,
                    config.worstCaseRemainingMinorUnits,
                    config.quotaCurrency
                  )}
                </p>
                <p>
                  <span className="font-semibold">{t('kb.graphMaxCost')}:</span>{' '}
                  {formatMinorUnits(
                    format,
                    config.maxCostMinorUnits,
                    config.quotaCurrency
                  )}
                </p>
                {config.costStatus ? (
                  <p>
                    <span className="font-semibold">
                      {t('kb.graphCostStatus')}:
                    </span>{' '}
                    {costStatusLabel(config.costStatus, costStatusLabels)}
                  </p>
                ) : null}
                {config.actualCostMinorUnits != null ? (
                  <p data-cy="kb-knowledge-graph-actual-cost">
                    <span className="font-semibold">
                      {t('kb.graphActualCost')}:
                    </span>{' '}
                    {formatMinorUnits(
                      format,
                      config.actualCostMinorUnits,
                      config.costCurrency
                    )}
                  </p>
                ) : null}
              </div>
              {config.actualRequestCount != null ? (
                <p
                  className="mt-2 text-xs text-slate-500"
                  data-cy="kb-knowledge-graph-actual-usage"
                >
                  {t('kb.graphActualUsage', {
                    requests: config.actualRequestCount,
                    inputTokens: config.actualInputTokens ?? 0,
                    outputTokens: config.actualOutputTokens ?? 0,
                    embeddingTokens: config.actualEmbeddingTokens ?? 0,
                  })}
                </p>
              ) : null}
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

            {detailsOpen ? (
              <div>
                <h3 className="mb-2 font-semibold text-slate-900">
                  {t('kb.graphPreviewTitle')}
                </h3>
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
            ) : null}
          </>
        )}
      </section>
    </details>
  )
}

export default KnowledgeGraphPanel
