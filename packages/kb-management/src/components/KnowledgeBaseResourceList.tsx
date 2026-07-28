import {
  NetworkStatus,
  useLazyQuery,
  useMutation,
  useQuery,
} from '@apollo/client'
import {
  faFileLines,
  faLink,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetKbResourceIngestionRunsDocument,
  GetKbResourcesDocument,
  IngestKbResourceDocument,
  KbIngestionStatus,
  KbResourceStatus,
  KbResourceType,
  type GetKbResourcesQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  H3,
  Modal,
  Skeleton,
  TextField,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import DeleteKnowledgeBaseResourceModal from './DeleteKnowledgeBaseResourceModal'
import DeleteKnowledgeBaseResourcesModal from './DeleteKnowledgeBaseResourcesModal'

const PAGE_SIZE = 20
const MAX_BULK_SELECTION = 50

type KnowledgeBaseResource =
  GetKbResourcesQuery['getKbResources']['items'][number]

function getUrlHost(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return '—'
  try {
    return new URL(sourceUrl).host
  } catch {
    return sourceUrl
  }
}

function isActiveResource(resource: KnowledgeBaseResource) {
  return (
    resource.status === KbResourceStatus.Queued ||
    resource.status === KbResourceStatus.Processing ||
    resource.latestIngestionRun?.status === KbIngestionStatus.Queued ||
    resource.latestIngestionRun?.status === KbIngestionStatus.Processing
  )
}

function RunStatusBadge({
  status,
  dataCy,
}: {
  status: KbIngestionStatus
  dataCy: string
}) {
  const t = useTranslations()
  const presentation = (() => {
    switch (status) {
      case KbIngestionStatus.Queued:
        return {
          label: t('kb.runStatusQueued'),
          className: 'border-amber-300 bg-amber-100 text-amber-900',
        }
      case KbIngestionStatus.Processing:
        return {
          label: t('kb.runStatusProcessing'),
          className: 'border-amber-300 bg-amber-100 text-amber-900',
        }
      case KbIngestionStatus.Succeeded:
        return {
          label: t('kb.runStatusSucceeded'),
          className: 'border-green-300 bg-green-100 text-green-800',
        }
      case KbIngestionStatus.Failed:
        return {
          label: t('kb.runStatusFailed'),
          className: 'border-red-300 bg-red-100 text-red-800',
        }
      case KbIngestionStatus.Superseded:
        return {
          label: t('kb.runStatusSuperseded'),
          className: 'border-slate-300 bg-slate-100 text-slate-700',
        }
    }
  })()

  return (
    <Badge
      variant="outline"
      className={presentation.className}
      data-cy={dataCy}
    >
      {status === KbIngestionStatus.Processing ? (
        <FontAwesomeIcon
          icon={faSpinner}
          className="h-3 w-3 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : null}
      {presentation.label}
    </Badge>
  )
}

function RunStatusMessage({
  status,
  errorCode,
  className,
  dataCy,
}: {
  status: KbIngestionStatus
  errorCode?: string | null
  className?: string
  dataCy?: string
}) {
  const t = useTranslations()
  const message = (() => {
    if (errorCode === 'QUEUE_DISPATCH_FAILED') {
      return t('kb.ingestResourceError')
    }
    if (errorCode === 'INGESTION_DISPATCH_FAILED') {
      return t('kb.ingestionStartError')
    }
    if (errorCode === 'KB_STORAGE_LIMIT_REACHED') {
      return t('kb.storageLimitError')
    }
    if (status === KbIngestionStatus.Failed) {
      return t('kb.ingestionFailed')
    }
    if (status === KbIngestionStatus.Superseded) {
      return t('kb.ingestionSuperseded')
    }
    return null
  })()

  return message ? (
    <p className={className} data-cy={dataCy}>
      {message}
    </p>
  ) : null
}

function KnowledgeBaseResourceHistory({
  resourceId,
  refreshKey,
}: {
  resourceId: string
  refreshKey: number
}) {
  const t = useTranslations()
  const format = useFormatter()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [loadRuns, { data, loading, error }] = useLazyQuery(
    GetKbResourceIngestionRunsDocument,
    { variables: { resourceId } }
  )

  useEffect(() => {
    if (refreshKey > 0 && detailsRef.current?.open) {
      void loadRuns({ fetchPolicy: 'network-only' })
    }
  }, [loadRuns, refreshKey])

  return (
    <details
      ref={detailsRef}
      className="mt-4 border-t border-slate-200 pt-4"
      data-cy={`kb-resource-history-${resourceId}`}
      onToggle={(event) => {
        if (event.currentTarget.open && !loading) {
          void loadRuns({ fetchPolicy: 'network-only' })
        }
      }}
    >
      <summary className="text-primary-100 cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
        {t('kb.recentAttempts')}
      </summary>
      {loading ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          {t('shared.generic.loading')}
        </p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {t('kb.historyLoadError')}
        </p>
      ) : data?.getKbResourceIngestionRuns.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          {t('kb.noRecentAttempts')}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {data?.getKbResourceIngestionRuns.map((run) => (
            <li
              key={run.id}
              className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-center"
              data-cy={`kb-ingestion-run-${run.id}`}
            >
              <RunStatusBadge
                status={run.status}
                dataCy={`kb-ingestion-run-status-${run.id}`}
              />
              <div className="min-w-0 text-slate-600">
                <span className="font-medium text-slate-800">
                  {t('kb.version', { version: run.resourceVersion })}
                </span>
                <RunStatusMessage
                  status={run.status}
                  errorCode={run.errorCode}
                  className="mt-1"
                />
              </div>
              <time
                dateTime={new Date(run.createdAt).toISOString()}
                className="text-slate-500"
              >
                {format.dateTime(new Date(run.createdAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

function OperationProgress({ resource }: { resource: KnowledgeBaseResource }) {
  const t = useTranslations()
  if (!isActiveResource(resource)) return null

  return (
    <div
      className="mt-3"
      role="progressbar"
      aria-label={t('kb.operationInProgress')}
      aria-valuetext={t('kb.operationInProgress')}
      data-cy={`kb-resource-progress-${resource.id}`}
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
        <div className="h-full w-full animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" />
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {t('kb.operationInProgress')}
      </p>
    </div>
  )
}

function KnowledgeBaseResourceList({
  kbId,
  refreshKey,
  onMetricsChanged,
}: {
  kbId: string
  refreshKey: number
  onMetricsChanged: () => Promise<unknown>
}) {
  const t = useTranslations()
  const format = useFormatter()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [typeFilter, setTypeFilter] = useState<KbResourceType | ''>('')
  const [statusFilter, setStatusFilter] = useState<KbIngestionStatus | ''>('')
  const [polling, setPolling] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletionTarget, setDeletionTarget] =
    useState<KnowledgeBaseResource | null>(null)
  const [bulkDeletionOpen, setBulkDeletionOpen] = useState(false)
  const [inspectorId, setInspectorId] = useState<string | null>(null)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const [historyRefreshes, setHistoryRefreshes] = useState<
    Record<string, number>
  >({})
  const pollInFlightRef = useRef(false)
  const variables = {
    kbId,
    first: PAGE_SIZE,
    search: deferredSearch || null,
    type: typeFilter || null,
    status: statusFilter || null,
  }
  const {
    data,
    loading,
    error,
    fetchMore,
    refetch,
    networkStatus,
    updateQuery,
  } = useQuery(GetKbResourcesDocument, {
    variables,
    notifyOnNetworkStatusChange: true,
  })
  const [fetchResourcePoll] = useLazyQuery(GetKbResourcesDocument, {
    fetchPolicy: 'no-cache',
  })
  const [ingestResource] = useMutation(IngestKbResourceDocument)
  const connection = data?.getKbResources
  const resources = connection?.items ?? []
  const loadingMore = networkStatus === NetworkStatus.fetchMore
  const inspectorResource = useMemo(
    () => resources.find(({ id }) => id === inspectorId) ?? null,
    [inspectorId, resources]
  )
  const selectableIds = resources
    .filter((resource) => !isActiveResource(resource))
    .map(({ id }) => id)
  const bulkSelectableIds = selectableIds.slice(0, MAX_BULK_SELECTION)
  const allPageSelected =
    bulkSelectableIds.length > 0 &&
    bulkSelectableIds.every((id) => selectedIds.has(id))

  useEffect(() => {
    setPolling(resources.some(isActiveResource))
  }, [resources])

  useEffect(() => {
    if (!polling) return

    const pollCurrentPage = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const { data: pollData } = await fetchResourcePoll({
          variables: {
            kbId,
            first: PAGE_SIZE,
            after: null,
            search: deferredSearch || null,
            type: typeFilter || null,
            status: statusFilter || null,
          },
        })
        if (!pollData) return

        updateQuery((previous) => {
          const refreshedItems = pollData.getKbResources.items
          const refreshedIds = new Set(refreshedItems.map(({ id }) => id))
          const retainedLoadedItems = previous.getKbResources.items
            .slice(PAGE_SIZE)
            .filter(({ id }) => !refreshedIds.has(id))

          return {
            ...pollData,
            getKbResources: {
              ...pollData.getKbResources,
              items: [...refreshedItems, ...retainedLoadedItems],
              pageInfo:
                previous.getKbResources.items.length > PAGE_SIZE
                  ? previous.getKbResources.pageInfo
                  : pollData.getKbResources.pageInfo,
            },
          }
        })
      } finally {
        pollInFlightRef.current = false
      }
    }

    const intervalId = window.setInterval(() => {
      void pollCurrentPage().catch((pollError) => {
        console.error('Failed to poll KB resource operations', pollError)
      })
    }, 2000)
    return () => window.clearInterval(intervalId)
  }, [
    deferredSearch,
    fetchResourcePoll,
    kbId,
    polling,
    statusFilter,
    typeFilter,
    updateQuery,
  ])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [deferredSearch, statusFilter, typeFilter])

  useEffect(() => {
    if (refreshKey > 0) void refetch()
  }, [refreshKey, refetch])

  const formatFileSize = (sizeBytes: number | null | undefined) => {
    if (sizeBytes === null || sizeBytes === undefined) return '—'
    if (sizeBytes < 1024) return `${format.number(sizeBytes)} B`
    if (sizeBytes < 1024 * 1024) {
      return `${format.number(sizeBytes / 1024, {
        maximumFractionDigits: 1,
      })} KiB`
    }
    return `${format.number(sizeBytes / (1024 * 1024), {
      maximumFractionDigits: 1,
    })} MiB`
  }

  const getStatusPresentation = (status: KbResourceStatus) => {
    switch (status) {
      case KbResourceStatus.Added:
        return {
          label: t('kb.statusAdded'),
          className: 'border-slate-300 bg-slate-100 text-slate-700',
        }
      case KbResourceStatus.Queued:
        return {
          label: t('kb.statusQueued'),
          className: 'border-amber-300 bg-amber-100 text-amber-900',
        }
      case KbResourceStatus.Processing:
        return {
          label: t('kb.statusProcessing'),
          className: 'border-amber-300 bg-amber-100 text-amber-900',
        }
      case KbResourceStatus.Ready:
        return {
          label: t('kb.statusReady'),
          className: 'border-green-300 bg-green-100 text-green-800',
        }
      case KbResourceStatus.Failed:
        return {
          label: t('kb.statusFailed'),
          className: 'border-red-300 bg-red-100 text-red-800',
        }
    }
  }

  const renderStatus = (resource: KnowledgeBaseResource) => {
    if (resource.latestIngestionRun) {
      return (
        <RunStatusBadge
          status={resource.latestIngestionRun.status}
          dataCy={`kb-resource-status-${resource.id}`}
        />
      )
    }
    const status = getStatusPresentation(resource.status)
    return (
      <Badge
        variant="outline"
        className={status.className}
        data-cy={`kb-resource-status-${resource.id}`}
      >
        {status.label}
      </Badge>
    )
  }

  const refreshWorkspace = async () => {
    await Promise.all([refetch(), onMetricsChanged()])
  }

  const handleIngest = async (resource: KnowledgeBaseResource) => {
    if (ingestingId !== null) return
    setIngestingId(resource.id)
    try {
      await ingestResource({ variables: { id: resource.id } })
      await refreshWorkspace()
      setHistoryRefreshes((current) => ({
        ...current,
        [resource.id]: (current[resource.id] ?? 0) + 1,
      }))
      toast({ type: 'success', message: t('kb.ingestResourceSuccess') })
    } catch (mutationError) {
      console.error('Failed to queue KB resource ingestion', mutationError)
      toast({ type: 'error', message: t('kb.ingestResourceError') })
    } finally {
      setIngestingId(null)
    }
  }

  const getIngestActionLabel = (resource: KnowledgeBaseResource) => {
    if (resource.status === KbResourceStatus.Added) {
      return t('kb.ingestResource')
    }
    if (resource.status === KbResourceStatus.Failed) {
      return t('kb.retryIngestion')
    }
    return t('kb.reingestResource')
  }

  const loadMore = async () => {
    if (!connection?.pageInfo.hasNextPage || loadingMore) return
    await fetchMore({
      variables: { after: connection.pageInfo.endCursor },
      updateQuery: (previous, { fetchMoreResult }) => ({
        ...fetchMoreResult,
        getKbResources: {
          ...fetchMoreResult.getKbResources,
          items: [
            ...previous.getKbResources.items,
            ...fetchMoreResult.getKbResources.items,
          ],
        },
      }),
    })
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_BULK_SELECTION) next.add(id)
      return next
    })
  }

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allPageSelected) bulkSelectableIds.forEach((id) => next.delete(id))
      else {
        bulkSelectableIds.forEach((id) => {
          if (next.size < MAX_BULK_SELECTION) next.add(id)
        })
      }
      return next
    })
  }

  const selectedResources = resources.filter(({ id }) => selectedIds.has(id))

  return (
    <section className="mt-8" data-cy="kb-resource-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <H3>{t('kb.resourcesTitle')}</H3>
        {selectedIds.size > 0 ? (
          <Button
            destructive
            onClick={() => setBulkDeletionOpen(true)}
            data={{ cy: 'delete-selected-kb-resources' }}
          >
            <Button.Label>
              {t('kb.bulkDelete', { count: selectedIds.size })}
            </Button.Label>
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <TextField
          id="kb-resource-search"
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={setSearch}
          label={t('kb.searchResources')}
          placeholder={t('kb.searchResourcesPlaceholder')}
          data={{ cy: 'kb-resource-search' }}
        />
        <label className="block text-sm font-medium text-slate-700">
          {t('kb.filterType')}
          <select
            name="kb-resource-type-filter"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as KbResourceType | '')
            }
            className="focus-visible:border-primary-100 focus-visible:ring-primary-100 mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-1"
            data-cy="kb-resource-type-filter"
          >
            <option value="">{t('kb.filterAll')}</option>
            <option value={KbResourceType.Blob}>{t('kb.typeFile')}</option>
            <option value={KbResourceType.Url}>{t('kb.typeUrl')}</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {t('kb.filterStatus')}
          <select
            name="kb-resource-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as KbIngestionStatus | '')
            }
            className="focus-visible:border-primary-100 focus-visible:ring-primary-100 mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-1"
            data-cy="kb-resource-status-filter"
          >
            <option value="">{t('kb.filterAll')}</option>
            <option value={KbIngestionStatus.Queued}>
              {t('kb.runStatusQueued')}
            </option>
            <option value={KbIngestionStatus.Processing}>
              {t('kb.runStatusProcessing')}
            </option>
            <option value={KbIngestionStatus.Succeeded}>
              {t('kb.runStatusSucceeded')}
            </option>
            <option value={KbIngestionStatus.Failed}>
              {t('kb.runStatusFailed')}
            </option>
            <option value={KbIngestionStatus.Superseded}>
              {t('kb.runStatusSuperseded')}
            </option>
          </select>
        </label>
      </div>

      {polling ? (
        <UserNotification
          className={{ root: 'mt-3' }}
          message={t('kb.backgroundOperationsMessage')}
          data={{ cy: 'kb-background-operations' }}
        />
      ) : null}

      {loading && !connection ? (
        <div
          className="mt-4 space-y-3"
          role="status"
          aria-label={t('shared.generic.loading')}
        >
          <Skeleton
            className="h-40 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
          <Skeleton
            className="h-40 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      ) : error ? (
        <UserNotification
          type="error"
          className={{ root: 'mt-4' }}
          message={t('kb.resourcesLoadError')}
          data={{ cy: 'kb-resources-error' }}
        />
      ) : resources.length === 0 ? (
        <div
          className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center"
          data-cy="kb-resources-empty"
        >
          <p className="text-slate-600">
            {deferredSearch || typeFilter || statusFilter
              ? t('kb.noResourceResults')
              : t('kb.noResources')}
          </p>
          {!deferredSearch && !typeFilter && !statusFilter ? (
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <a
                href="#kb-file-upload"
                className="bg-primary-100 hover:bg-primary-80 inline-flex min-h-10 w-full items-center justify-center rounded-md px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto"
                data-cy="kb-empty-upload-resource"
              >
                {t('kb.fileUploadTitle')}
              </a>
              <a
                href="#kb-link-form"
                className="text-primary-100 border-primary-100 hover:bg-uzh-blue-20 inline-flex min-h-10 w-full items-center justify-center rounded-md border px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto"
                data-cy="kb-empty-add-link"
              >
                {t('kb.linkTitle')}
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p aria-live="polite" data-cy="kb-resource-result-count">
              {t('kb.resourceResultCount', {
                count: connection?.totalCount ?? 0,
              })}
            </p>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 focus-within:outline-2 focus-within:outline-offset-2">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={togglePageSelection}
                className="h-4 w-4"
                data-cy="select-kb-resource-page"
              />
              {t('kb.selectAllPage')}
            </label>
          </div>
          <ul className="mt-3 space-y-3">
            {resources.map((resource) => {
              const active = isActiveResource(resource)
              return (
                <li
                  key={resource.id}
                  className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                  data-cy={`kb-resource-row-${resource.id}`}
                >
                  <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <label
                      className={`flex h-10 w-10 items-center justify-center rounded ${
                        active
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      }`}
                    >
                      <span className="sr-only">
                        {t('kb.selectResource', { title: resource.title })}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(resource.id)}
                        disabled={
                          active ||
                          (!selectedIds.has(resource.id) &&
                            selectedIds.size >= MAX_BULK_SELECTION)
                        }
                        onChange={() => toggleSelection(resource.id)}
                        className="h-4 w-4"
                        data-cy={`select-kb-resource-${resource.id}`}
                      />
                    </label>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-3">
                        <FontAwesomeIcon
                          icon={
                            resource.type === KbResourceType.Blob
                              ? faFileLines
                              : faLink
                          }
                          className="text-primary-100 mt-1 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {resource.title}
                          </div>
                          <div className="mt-1 break-all text-sm text-slate-600">
                            {resource.type === KbResourceType.Blob
                              ? formatFileSize(resource.sizeBytes)
                              : getUrlHost(resource.sourceUrl)}
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-4 grid gap-3 sm:grid-cols-2"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        <div
                          className="rounded-md bg-slate-50 p-3"
                          data-cy={`kb-resource-operation-${resource.id}`}
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t('kb.operationStatus')}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            {renderStatus(resource)}
                            <span>
                              {t('kb.version', {
                                version: resource.resourceVersion,
                              })}
                            </span>
                          </div>
                          {resource.latestIngestionRun ? (
                            <RunStatusMessage
                              status={resource.latestIngestionRun.status}
                              errorCode={resource.latestIngestionRun.errorCode}
                              className="mt-2 text-sm text-slate-600"
                              dataCy={`kb-resource-status-message-${resource.id}`}
                            />
                          ) : null}
                          <OperationProgress resource={resource} />
                        </div>
                        <div
                          className="rounded-md bg-slate-50 p-3"
                          data-cy={`kb-resource-serving-${resource.id}`}
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t('kb.servingStatus')}
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-800">
                            {resource.activeResourceVersion == null
                              ? t('kb.notServing')
                              : resource.activeResourceVersion ===
                                    resource.resourceVersion &&
                                  resource.status === KbResourceStatus.Ready
                                ? t('kb.servingCurrentVersion', {
                                    version: resource.activeResourceVersion,
                                  })
                                : t('kb.servingPreviousVersion', {
                                    version: resource.activeResourceVersion,
                                  })}
                          </div>
                          {resource.ingestedAt ? (
                            <div className="mt-1 text-sm text-slate-600">
                              {t('kb.servingSince', {
                                date: format.dateTime(
                                  new Date(resource.ingestedAt),
                                  {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  }
                                ),
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap lg:self-start">
                      <Button
                        onClick={() => setInspectorId(resource.id)}
                        data={{ cy: `inspect-kb-resource-${resource.id}` }}
                        className={{ root: 'w-full sm:w-auto' }}
                      >
                        <Button.Label>{t('kb.inspectResource')}</Button.Label>
                      </Button>
                      <Button
                        destructive
                        disabled={active || ingestingId !== null}
                        onClick={() => setDeletionTarget(resource)}
                        data={{ cy: `delete-kb-resource-${resource.id}` }}
                        className={{ root: 'w-full sm:w-auto' }}
                      >
                        <Button.Label>
                          {t('shared.generic.delete')}
                        </Button.Label>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-slate-500">
                    {t('kb.updatedAt', {
                      date: format.dateTime(new Date(resource.updatedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
          {connection?.pageInfo.hasNextPage ? (
            <div className="mt-5 flex justify-center">
              <Button
                onClick={loadMore}
                loading={loadingMore}
                disabled={loadingMore}
                data={{ cy: 'load-more-kb-resources' }}
              >
                <Button.Label>{t('kb.loadMoreResources')}</Button.Label>
              </Button>
            </div>
          ) : null}
        </>
      )}

      {inspectorResource ? (
        <Modal
          open
          onClose={() => setInspectorId(null)}
          title={t('kb.inspectorTitle')}
          primaryLabel={getIngestActionLabel(inspectorResource)}
          primaryLoading={ingestingId === inspectorResource.id}
          primaryDisabled={
            ingestingId !== null || isActiveResource(inspectorResource)
          }
          onPrimaryAction={() => handleIngest(inspectorResource)}
          secondaryLabel={t('shared.generic.close')}
          onSecondaryAction={() => setInspectorId(null)}
          dataContent={{ cy: 'kb-resource-inspector' }}
          dataCloseButton={{ cy: 'close-kb-resource-inspector' }}
          dataPrimaryAction={{ cy: 'ingest-kb-resource-inspector' }}
          dataSecondaryAction={{ cy: 'done-kb-resource-inspector' }}
          className={{ content: 'max-w-2xl' }}
        >
          <div className="space-y-4">
            <div>
              <div className="break-words text-lg font-semibold">
                {inspectorResource.title}
              </div>
              <div className="mt-2">{renderStatus(inspectorResource)}</div>
              <OperationProgress resource={inspectorResource} />
            </div>
            <dl className="grid gap-3 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-600">
                  {t('kb.sourceType')}
                </dt>
                <dd className="mt-1 break-words text-slate-900">
                  {inspectorResource.type === KbResourceType.Blob
                    ? t('kb.typeFile')
                    : t('kb.typeUrl')}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  {t('kb.fileSize')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {formatFileSize(inspectorResource.sizeBytes)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  {t('kb.fileName')}
                </dt>
                <dd className="mt-1 break-all text-slate-900">
                  {inspectorResource.originalFilename || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  {t('kb.mimeType')}
                </dt>
                <dd className="mt-1 break-all text-slate-900">
                  {inspectorResource.mimeType || '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-slate-600">
                  {t('kb.sourceLocation')}
                </dt>
                <dd className="mt-1 break-all text-slate-900">
                  {inspectorResource.sourceUrl || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  {t('kb.createdAt')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {format.dateTime(new Date(inspectorResource.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  {t('kb.servingStatus')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {inspectorResource.activeResourceVersion == null
                    ? t('kb.notServing')
                    : inspectorResource.activeResourceVersion ===
                          inspectorResource.resourceVersion &&
                        inspectorResource.status === KbResourceStatus.Ready
                      ? t('kb.servingCurrentVersion', {
                          version: inspectorResource.activeResourceVersion,
                        })
                      : t('kb.servingPreviousVersion', {
                          version: inspectorResource.activeResourceVersion,
                        })}
                </dd>
              </div>
            </dl>
            <KnowledgeBaseResourceHistory
              resourceId={inspectorResource.id}
              refreshKey={historyRefreshes[inspectorResource.id] ?? 0}
            />
            <Button
              destructive
              disabled={
                isActiveResource(inspectorResource) || ingestingId !== null
              }
              onClick={() => {
                setInspectorId(null)
                setDeletionTarget(inspectorResource)
              }}
              data={{ cy: 'delete-kb-resource-inspector' }}
            >
              <Button.Label>{t('shared.generic.delete')}</Button.Label>
            </Button>
          </div>
        </Modal>
      ) : null}

      {deletionTarget ? (
        <DeleteKnowledgeBaseResourceModal
          resource={deletionTarget}
          onClose={() => setDeletionTarget(null)}
          onDeleted={async () => {
            setSelectedIds((current) => {
              const next = new Set(current)
              next.delete(deletionTarget.id)
              return next
            })
            await refreshWorkspace()
          }}
        />
      ) : null}

      {bulkDeletionOpen ? (
        <DeleteKnowledgeBaseResourcesModal
          kbId={kbId}
          resources={selectedResources}
          onClose={() => setBulkDeletionOpen(false)}
          onDeleted={async () => {
            setSelectedIds(new Set())
            await refreshWorkspace()
          }}
        />
      ) : null}
    </section>
  )
}

export default KnowledgeBaseResourceList
