'use client'

import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import type {
  GetKbKnowledgeGraphNeighborsQuery,
  GetKbKnowledgeGraphOverviewQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  GetKbKnowledgeGraphDomainConfigDocument,
  GetKbKnowledgeGraphNeighborsDocument,
  GetKbKnowledgeGraphOverviewDocument,
  KbGraphBuildStatus,
  KbGraphCostStatus,
  KbGraphQualityTier,
  RebuildKbKnowledgeGraphWithDomainDocument,
  SearchKbKnowledgeGraphDocument,
  SetKbKnowledgeGraphEnabledDocument,
} from '@klicker-uzh/graphql/dist/ops'
import type { KnowledgeGraphDataSource } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import { KnowledgeGraphUnavailableError } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { Badge, Button, SelectField, Switch } from '@uzh-bf/design-system'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useFormatter, useTranslations } from 'next-intl'
// biome-ignore lint/correctness/noUnusedImports: this package uses the classic JSX transform.
import React, { useEffect, useMemo, useState } from 'react'

const KnowledgeGraphViewer = dynamic(
  () =>
    import(
      '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
    ).then((module) => module.KnowledgeGraphViewer),
  { ssr: false }
)

// Explicit domain selection is German-first: the graph is always generated in
// German, independent of the interface locale, so the panel offers domains but
// never a generation language.
const DOMAIN_GENERATION_LANGUAGE = 'German'
const DEFAULT_DOMAIN_POLICY_ID = 'finance'
const DEFAULT_DOMAIN_POLICY_VERSION = 1

type KnowledgeGraphDomainSelection = { id: string; version: number | null }

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

type GraphErrorDetails = {
  code?: string
  remainingMinorUnits?: number
}

function getGraphErrorDetails(error: unknown): GraphErrorDetails | null {
  if (!error || typeof error !== 'object') return null

  const extensions = (error as { extensions?: Record<string, unknown> })
    .extensions
  if (extensions) {
    const code =
      typeof extensions.code === 'string' ? extensions.code : undefined
    const remainingMinorUnits =
      typeof extensions.remainingMinorUnits === 'number'
        ? extensions.remainingMinorUnits
        : undefined
    if (code || remainingMinorUnits !== undefined) {
      return { code, remainingMinorUnits }
    }
  }

  for (const key of ['graphQLErrors', 'errors'] as const) {
    const nestedErrors = (error as Record<string, unknown>)[key]
    if (!Array.isArray(nestedErrors)) continue

    for (const nestedError of nestedErrors) {
      const details = getGraphErrorDetails(nestedError)
      if (details?.code) return details
    }
  }

  return null
}

function normalizeGraphError(error: unknown): never {
  if (getGraphErrorDetails(error)?.code?.startsWith('KB_GRAPH_')) {
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
  const router = useRouter()
  const [selectedTier, setSelectedTier] = useState<KbGraphQualityTier>(
    KbGraphQualityTier.Standard
  )
  const [userDomainSelection, setUserDomainSelection] =
    useState<KnowledgeGraphDomainSelection | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    GetKbKnowledgeGraphDomainConfigDocument,
    {
      variables: { kbId },
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    }
  )
  const [rebuildGraph, { loading: isRebuilding }] = useMutation(
    RebuildKbKnowledgeGraphWithDomainDocument
  )
  const [setGraphEnabled, { loading: isTogglingEnabled }] = useMutation(
    SetKbKnowledgeGraphEnabledDocument
  )
  const config = data?.getKbKnowledgeGraphConfig
  const domainConfig = data?.getKbKnowledgeGraphDomainConfig

  useEffect(() => {
    if (router.asPath.endsWith('#knowledge-graph')) {
      setDetailsOpen(true)
    }
  }, [router.asPath])
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
  const formattedRemainingQuota = formatMinorUnits(
    format,
    config?.remainingSemesterQuotaMinorUnits,
    config?.quotaCurrency
  )
  const insufficientQuota =
    selectedEstimate != null &&
    config?.remainingSemesterQuotaMinorUnits != null &&
    selectedEstimate > config.remainingSemesterQuotaMinorUnits

  const domainCapabilityEnabled = domainConfig?.capabilityEnabled ?? false
  const domainOptions = domainConfig?.options ?? []
  const domainOptionValue = (option: { id: string; version: number }) =>
    `${option.id}@${option.version}`
  // An explicit selection is only ever restored, never upgraded or substituted:
  // the persisted build metadata wins until the lecturer changes the control,
  // and a retired id/version pair stays selected instead of moving to another
  // version the catalog happens to keep.
  const hasPersistedDomainSelection =
    config?.domainPolicyId != null ||
    config?.domainPolicyVersion != null ||
    config?.domainPolicyLanguage != null
  const persistedDomainSelection =
    config?.domainPolicyId != null
      ? {
          id: config.domainPolicyId,
          version: config.domainPolicyVersion ?? null,
        }
      : null
  const domainSelection: KnowledgeGraphDomainSelection = userDomainSelection ??
    persistedDomainSelection ?? {
      id: DEFAULT_DOMAIN_POLICY_ID,
      version: DEFAULT_DOMAIN_POLICY_VERSION,
    }
  const domainSelectedOption = domainOptions.find(
    (option) =>
      option.id === domainSelection.id &&
      option.version === domainSelection.version
  )
  const domainSelectionSupported =
    // The generation language is fixed to German, so a catalog option that
    // keeps no German categories cannot produce this build and stays blocked.
    domainCapabilityEnabled &&
    (domainSelectedOption?.languages.some(
      (language) => language.language === DOMAIN_GENERATION_LANGUAGE
    ) ??
      false)
  // A retired pair is reported from the persisted build metadata and must not
  // borrow another option's categories, so only the untouched persisted
  // selection falls back to the categories the build itself recorded.
  const showingPersistedDomain =
    userDomainSelection == null && persistedDomainSelection != null
  const domainCategoryNames =
    domainSelectedOption?.languages
      .find((language) => language.language === DOMAIN_GENERATION_LANGUAGE)
      ?.categories.map((category) => category.name) ??
    (showingPersistedDomain
      ? (config?.domainCategories ?? []).map((category) => category.name)
      : [])
  // A closed capability gate may not silently fall back to the provider default
  // domain, so a stored explicit selection blocks the rebuild until the gate
  // accepts an explicit replacement again.
  const domainSubmitBlocked = domainCapabilityEnabled
    ? !domainSelectionSupported
    : hasPersistedDomainSelection
  const showDomainDetails =
    domainCapabilityEnabled ||
    domainSubmitBlocked ||
    domainCategoryNames.length > 0

  const translateDomainLabelKey = (labelKey: string): string | null => {
    switch (labelKey) {
      case 'finance':
        return t('kb.graphDomainFinance')
      case 'economics':
        return t('kb.graphDomainEconomics')
      case 'business':
        return t('kb.graphDomainBusiness')
      case 'mathematics':
        return t('kb.graphDomainMathematics')
      case 'informatics':
        return t('kb.graphDomainInformatics')
      case 'general-academic':
        return t('kb.graphDomainGeneralAcademic')
      default:
        return null
    }
  }
  const domainOptionLabel = (option: { id: string; labelKey: string }) =>
    translateDomainLabelKey(option.labelKey) ?? option.id
  const domainLabelForId = (id: string) => {
    const option = domainOptions.find((candidate) => candidate.id === id)
    // A stored contract domain keeps its label even when the catalog no longer
    // offers the pair, so a closed gate or a retired version still reads as a
    // domain instead of an internal id.
    return option ? domainOptionLabel(option) : translateDomainLabelKey(id)
  }
  const formatDomainVersion = (version: number | null) =>
    version == null ? t('kb.graphDomainVersionUnknown') : String(version)
  const translateDomainLanguage = (language: string | null) => {
    switch (language) {
      case 'German':
        return t('kb.graphDomainLanguageGerman')
      case 'English':
        return t('kb.graphDomainLanguageEnglish')
      default:
        return '—'
    }
  }
  const domainItems = domainOptions.map((option) => ({
    value: domainOptionValue(option),
    label: domainOptionLabel(option),
  }))
  const domainSelectValue = domainSelectedOption
    ? domainOptionValue(domainSelectedOption)
    : ''

  // A failed or superseded attempt must not relabel the graph that is actually
  // served, so the published build's own domain is reported separately. A
  // legacy published build records no triple, and by contract that served graph
  // was generated with the default Finance v1 in German; applying that default
  // only here leaves the stored null values meaning "no explicit domain".
  const legacyDomain = {
    id: DEFAULT_DOMAIN_POLICY_ID,
    version: DEFAULT_DOMAIN_POLICY_VERSION,
    language: DOMAIN_GENERATION_LANGUAGE,
  }
  const reportedDomain = {
    id: config?.domainPolicyId ?? null,
    version: config?.domainPolicyVersion ?? null,
    language: config?.domainPolicyLanguage ?? null,
  }
  const publishedDomain = {
    id:
      config?.publishedDomainPolicyId ??
      (hasPublishedGraph ? legacyDomain.id : null),
    version:
      config?.publishedDomainPolicyVersion ??
      (hasPublishedGraph ? legacyDomain.version : null),
    language:
      config?.publishedDomainPolicyLanguage ??
      (hasPublishedGraph ? legacyDomain.language : null),
  }
  // Both sides take the effective legacy default, so two legacy builds that
  // serve the same domain are not reported as different.
  const effectiveDomain = (domain: {
    id: string | null
    version: number | null
    language: string | null
  }) => ({
    id: domain.id ?? legacyDomain.id,
    version: domain.version ?? legacyDomain.version,
    language: domain.language ?? legacyDomain.language,
  })
  const effectivePublishedDomain = effectiveDomain(publishedDomain)
  const effectiveReportedDomain = effectiveDomain(reportedDomain)
  const showPublishedDomain =
    publishedDomain.id != null &&
    (effectivePublishedDomain.id !== effectiveReportedDomain.id ||
      effectivePublishedDomain.version !== effectiveReportedDomain.version ||
      effectivePublishedDomain.language !== effectiveReportedDomain.language)
  const publishedDomainLabel =
    publishedDomain.id != null
      ? (domainLabelForId(publishedDomain.id) ?? publishedDomain.id)
      : null

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
    if (
      isRebuilding ||
      isActive ||
      !config?.isEnabled ||
      insufficientQuota ||
      domainSubmitBlocked
    ) {
      return
    }

    setOperationError(null)
    // An omitted triple is the legacy path for a deployment whose capability
    // gate is closed; only an enabled, supported selection is sent explicitly.
    const domainVariables =
      domainCapabilityEnabled && domainSelectedOption !== undefined
        ? {
            domainPolicyId: domainSelectedOption.id,
            domainPolicyVersion: domainSelectedOption.version,
            domainPolicyLanguage: DOMAIN_GENERATION_LANGUAGE,
          }
        : {}
    try {
      const result = await rebuildGraph({
        variables: { kbId, qualityTier: selectedTier, ...domainVariables },
      })
      const buildId = result.data?.rebuildKbKnowledgeGraphWithDomain.buildId
      if (buildId) {
        window.dispatchEvent(
          new CustomEvent('klicker:generation-started', {
            detail: {
              kind: 'graph',
              id: buildId,
              kbId,
              label: t('kb.graphTitle'),
              startedAt: Date.now(),
            },
          })
        )
      }
      await refetch()
    } catch (error) {
      console.error('Failed to rebuild KB knowledge graph', { kbId })
      const details = getGraphErrorDetails(error)
      if (details?.code === 'KB_GRAPH_QUOTA_EXCEEDED') {
        setOperationError(
          t('kb.graphQuotaInsufficient', {
            estimate: formattedSelectedEstimate,
            remaining: formatMinorUnits(
              format,
              details.remainingMinorUnits ??
                config.remainingSemesterQuotaMinorUnits,
              config.quotaCurrency
            ),
          })
        )
        try {
          await refetch()
        } catch {
          console.warn('Failed to refresh KB graph quota after rejection', {
            kbId,
          })
        }
      } else {
        setOperationError(t('kb.graphBuildError'))
      }
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
      id="knowledge-graph"
      open={detailsOpen}
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
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                {domainCapabilityEnabled ? (
                  <SelectField
                    label={t('kb.graphDomainLabel')}
                    items={domainItems}
                    value={domainSelectValue}
                    placeholder={t('kb.graphDomainSelectPlaceholder')}
                    onChange={(value) => {
                      setOperationError(null)
                      const option = domainOptions.find(
                        (candidate) => domainOptionValue(candidate) === value
                      )
                      if (!option) return
                      setUserDomainSelection({
                        id: option.id,
                        version: option.version,
                      })
                    }}
                    disabled={
                      isActive ||
                      isRebuilding ||
                      !config.isEnabled ||
                      !config.costConfigurationReady
                    }
                    data={{ cy: 'kb-knowledge-graph-domain' }}
                    className={{
                      root: 'w-full',
                      select: { trigger: 'w-full' },
                    }}
                  />
                ) : (
                  <div
                    className="space-y-1"
                    data-cy="kb-knowledge-graph-domain"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {t('kb.graphDomainLabel')}
                    </span>
                    <p className="text-sm text-slate-600">
                      {persistedDomainSelection
                        ? (domainLabelForId(persistedDomainSelection.id) ??
                          persistedDomainSelection.id)
                        : t('kb.graphDomainFinance')}
                    </p>
                  </div>
                )}
                <SelectField
                  label={t('kb.graphQualityTierLabel')}
                  items={tierItems}
                  value={selectedTier}
                  onChange={(value) => {
                    setOperationError(null)
                    setSelectedTier(value as KbGraphQualityTier)
                  }}
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
                    !config.costConfigurationReady ||
                    insufficientQuota ||
                    domainSubmitBlocked
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
              {showDomainDetails ? (
                <div className="mt-3 space-y-2">
                  {domainCapabilityEnabled ? (
                    <p className="text-xs text-slate-500">
                      {t('kb.graphDomainLanguageNote')}
                    </p>
                  ) : null}
                  {domainSubmitBlocked ? (
                    <p
                      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
                      role="status"
                      data-cy="kb-knowledge-graph-domain-unsupported"
                    >
                      {domainCapabilityEnabled
                        ? t('kb.graphDomainCurrentUnavailable', {
                            domain:
                              domainLabelForId(domainSelection.id) ??
                              domainSelection.id,
                            version: formatDomainVersion(
                              domainSelection.version
                            ),
                          })
                        : t('kb.graphDomainRebuildBlocked', {
                            domain:
                              domainLabelForId(domainSelection.id) ??
                              domainSelection.id,
                            version: formatDomainVersion(
                              persistedDomainSelection?.version ?? null
                            ),
                            language: translateDomainLanguage(
                              reportedDomain.language
                            ),
                          })}
                    </p>
                  ) : null}
                  {domainCategoryNames.length > 0 ? (
                    <div
                      className="flex flex-wrap items-center gap-2"
                      data-cy="kb-knowledge-graph-domain-categories"
                    >
                      <span className="text-xs font-semibold text-slate-600">
                        {t('kb.graphDomainCategoriesLabel')}:
                      </span>
                      {domainCategoryNames.map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showPublishedDomain && publishedDomainLabel != null ? (
                <p
                  className="mt-2 text-xs text-slate-500"
                  data-cy="kb-knowledge-graph-published-domain"
                >
                  {t('kb.graphDomainPublished', {
                    domain: publishedDomainLabel,
                    version: formatDomainVersion(publishedDomain.version),
                    language: translateDomainLanguage(publishedDomain.language),
                  })}
                </p>
              ) : null}
              {insufficientQuota ? (
                <p
                  className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                  role="status"
                  data-cy="kb-knowledge-graph-quota-insufficient"
                >
                  {t('kb.graphQuotaInsufficient', {
                    estimate: formattedSelectedEstimate,
                    remaining: formattedRemainingQuota,
                  })}
                </p>
              ) : null}
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
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">
                    {t('kb.graphPreviewTitle')}
                  </h3>
                  {config.elementGenerationReady ? (
                    <Button
                      primary
                      onClick={() =>
                        void router.push({
                          pathname: '/elements/generate',
                          query: { kbId },
                        })
                      }
                      data={{ cy: 'kb-generate-elements' }}
                    >
                      <Button.Label>
                        {t('kb.graphGenerateElements')}
                      </Button.Label>
                    </Button>
                  ) : null}
                </div>
                {hasPublishedGraph && !config.elementGenerationReady ? (
                  <p
                    className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                    data-cy="kb-element-generation-unavailable"
                  >
                    {t('kb.graphElementGenerationUnavailable')}
                  </p>
                ) : null}
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
