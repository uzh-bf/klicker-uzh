import { useLazyQuery, useMutation } from '@apollo/client'
import {
  faFileLines,
  faLink,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetKbDocument,
  GetKbResourceIngestionRunsDocument,
  IngestKbResourceDocument,
  KbIngestionStatus,
  KbResourceStatus,
  KbResourceType,
  type GetKbQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button, H3, toast } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useEffect, useRef, useState } from 'react'
import DeleteKnowledgeBaseResourceModal from './DeleteKnowledgeBaseResourceModal'

type KnowledgeBaseResource = GetKbQuery['getKb']['resources'][number]

function getUrlHost(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return '—'
  try {
    return new URL(sourceUrl).host
  } catch {
    return sourceUrl
  }
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
      className="mt-3 border-t border-slate-200 pt-3"
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

function KnowledgeBaseResourceList({
  kbId,
  resources,
}: {
  kbId: string
  resources: KnowledgeBaseResource[]
}) {
  const t = useTranslations()
  const format = useFormatter()
  const [deletionTarget, setDeletionTarget] =
    useState<KnowledgeBaseResource | null>(null)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const [historyRefreshes, setHistoryRefreshes] = useState<
    Record<string, number>
  >({})
  const [ingestResource] = useMutation(IngestKbResourceDocument)

  const formatFileSize = (sizeBytes: number | null | undefined) => {
    if (sizeBytes === null || sizeBytes === undefined) return '—'
    if (sizeBytes < 1024) return `${format.number(sizeBytes)} B`
    if (sizeBytes < 1024 * 1024) {
      return `${format.number(sizeBytes / 1024, {
        maximumFractionDigits: 1,
      })} KB`
    }
    return `${format.number(sizeBytes / (1024 * 1024), {
      maximumFractionDigits: 1,
    })} MB`
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
    const latestRun = resource.latestIngestionRun
    return latestRun ? (
      <RunStatusBadge
        status={latestRun.status}
        dataCy={`kb-resource-status-${resource.id}`}
      />
    ) : (
      (() => {
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
      })()
    )
  }

  const handleIngest = async (resource: KnowledgeBaseResource) => {
    if (ingestingId !== null) return
    setIngestingId(resource.id)
    try {
      await ingestResource({
        variables: { id: resource.id },
        refetchQueries: [{ query: GetKbDocument, variables: { id: kbId } }],
        awaitRefetchQueries: true,
      })
      setHistoryRefreshes((current) => ({
        ...current,
        [resource.id]: (current[resource.id] ?? 0) + 1,
      }))
      toast({ type: 'success', message: t('kb.ingestResourceSuccess') })
    } catch (error) {
      console.error('Failed to queue KB resource ingestion', error)
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

  return (
    <section className="mt-8" data-cy="kb-resource-list">
      <H3>{t('kb.resourcesTitle')}</H3>
      {resources.length === 0 ? (
        <div
          className="mt-3 rounded-md border border-dashed border-slate-300 p-6 text-center"
          data-cy="kb-resources-empty"
        >
          <p className="text-slate-600">{t('kb.noResources')}</p>
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
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              data-cy={`kb-resource-row-${resource.id}`}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <FontAwesomeIcon
                      icon={
                        resource.type === KbResourceType.Blob
                          ? faFileLines
                          : faLink
                      }
                      className="text-primary-100 mt-1 h-4 w-4 shrink-0"
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
                    primary
                    onClick={() => handleIngest(resource)}
                    loading={ingestingId === resource.id}
                    disabled={
                      ingestingId !== null ||
                      resource.status === KbResourceStatus.Queued ||
                      resource.status === KbResourceStatus.Processing
                    }
                    data={{ cy: `ingest-kb-resource-${resource.id}` }}
                    className={{ root: 'w-full sm:w-auto' }}
                  >
                    <Button.Label>
                      {getIngestActionLabel(resource)}
                    </Button.Label>
                  </Button>
                  <Button
                    destructive
                    disabled={
                      ingestingId !== null ||
                      resource.status === KbResourceStatus.Queued ||
                      resource.status === KbResourceStatus.Processing
                    }
                    onClick={() => setDeletionTarget(resource)}
                    data={{ cy: `delete-kb-resource-${resource.id}` }}
                    className={{ root: 'w-full sm:w-auto' }}
                  >
                    <Button.Label>{t('shared.generic.delete')}</Button.Label>
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

              <KnowledgeBaseResourceHistory
                resourceId={resource.id}
                refreshKey={historyRefreshes[resource.id] ?? 0}
              />
            </li>
          ))}
        </ul>
      )}

      {deletionTarget ? (
        <DeleteKnowledgeBaseResourceModal
          kbId={kbId}
          resource={deletionTarget}
          onClose={() => setDeletionTarget(null)}
        />
      ) : null}
    </section>
  )
}

export default KnowledgeBaseResourceList
