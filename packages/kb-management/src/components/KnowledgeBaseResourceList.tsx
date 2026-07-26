import { useMutation } from '@apollo/client'
import {
  faFileLines,
  faLink,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetKbDocument,
  IngestKbResourceDocument,
  KbResourceStatus,
  KbResourceType,
  KbSpeedMode,
  type GetKbQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  H3,
  Select,
  toast,
  Tooltip,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useMemo, useState } from 'react'
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
  const [speedModeByResource, setSpeedModeByResource] = useState<
    Record<string, KbSpeedMode>
  >({})
  const [ingestResource] = useMutation(IngestKbResourceDocument)

  const speedModeItems = useMemo(
    () => [
      {
        value: KbSpeedMode.Balanced,
        label: t('kb.speedModeBalanced'),
        data: { cy: 'kb-speed-mode-balanced' },
      },
      {
        value: KbSpeedMode.Quality,
        label: t('kb.speedModeQuality'),
        data: { cy: 'kb-speed-mode-quality' },
      },
      {
        value: KbSpeedMode.Fast,
        label: t('kb.speedModeFast'),
        data: { cy: 'kb-speed-mode-fast' },
      },
    ],
    [t]
  )

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
    const status = getStatusPresentation(resource.status)
    const badge = (
      <Badge
        variant="outline"
        className={status.className}
        data-cy={`kb-resource-status-${resource.id}`}
      >
        {resource.status === KbResourceStatus.Processing ? (
          <FontAwesomeIcon
            icon={faSpinner}
            className="h-3 w-3 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {status.label}
      </Badge>
    )

    return resource.status === KbResourceStatus.Failed &&
      resource.statusMessage ? (
      <Tooltip
        tooltip={resource.statusMessage}
        data={{ cy: `kb-resource-status-message-${resource.id}` }}
        dataContent={{ cy: `kb-resource-status-tooltip-${resource.id}` }}
      >
        {badge}
      </Tooltip>
    ) : (
      badge
    )
  }

  const handleIngest = async (resource: KnowledgeBaseResource) => {
    if (ingestingId !== null) return
    setIngestingId(resource.id)
    try {
      await ingestResource({
        variables: {
          id: resource.id,
          speedMode: speedModeByResource[resource.id] ?? KbSpeedMode.Balanced,
        },
        refetchQueries: [{ query: GetKbDocument, variables: { id: kbId } }],
        awaitRefetchQueries: true,
      })
      toast({ type: 'success', message: t('kb.ingestResourceSuccess') })
    } catch (error) {
      console.error('Failed to queue KB resource ingestion', error)
      toast({ type: 'error', message: t('kb.ingestResourceError') })
    } finally {
      setIngestingId(null)
    }
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
              className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
              data-cy={`kb-resource-row-${resource.id}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <FontAwesomeIcon
                  icon={
                    resource.type === KbResourceType.Blob ? faFileLines : faLink
                  }
                  className="text-primary-100 mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{resource.title}</div>
                  <div className="mt-1 break-all text-sm text-slate-600">
                    {resource.type === KbResourceType.Blob
                      ? formatFileSize(resource.sizeBytes)
                      : getUrlHost(resource.sourceUrl)}
                  </div>
                </div>
              </div>
              <div
                className="flex flex-wrap items-center gap-2 text-sm text-slate-600"
                aria-live="polite"
                aria-atomic="true"
              >
                {renderStatus(resource)}
                <span>
                  {t('kb.updatedAt', {
                    date: format.dateTime(new Date(resource.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
                </span>
              </div>
              <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
                <div className="col-span-2 flex w-full flex-col sm:w-36">
                  <label
                    htmlFor={`kb-speed-mode-trigger-${resource.id}`}
                    className="my-auto -mb-0.5 mr-2 mt-1 min-w-max font-bold leading-6 text-gray-600"
                  >
                    {t('kb.speedModeLabel')}
                    <span className="sr-only">: {resource.title}</span>
                  </label>
                  <Select
                    id={`kb-speed-mode-trigger-${resource.id}`}
                    items={speedModeItems}
                    value={
                      speedModeByResource[resource.id] ?? KbSpeedMode.Balanced
                    }
                    onChange={(value) =>
                      setSpeedModeByResource((current) => ({
                        ...current,
                        [resource.id]: value as KbSpeedMode,
                      }))
                    }
                    disabled={
                      ingestingId !== null ||
                      resource.status === KbResourceStatus.Queued ||
                      resource.status === KbResourceStatus.Processing
                    }
                    data={{ cy: `kb-speed-mode-${resource.id}` }}
                    className={{
                      root: 'w-full',
                      trigger: 'w-full',
                    }}
                  />
                </div>
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
                  <Button.Label>{t('kb.ingestResource')}</Button.Label>
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
