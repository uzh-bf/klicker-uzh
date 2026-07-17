import { faFileLines, faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  KbResourceStatus,
  KbResourceType,
  type GetKbQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useState } from 'react'
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

  const statusLabel = (status: KbResourceStatus) => {
    switch (status) {
      case KbResourceStatus.Added:
        return t('kb.statusAdded')
      case KbResourceStatus.Queued:
        return t('kb.statusQueued')
      case KbResourceStatus.Processing:
        return t('kb.statusProcessing')
      case KbResourceStatus.Ready:
        return t('kb.statusReady')
      case KbResourceStatus.Failed:
        return t('kb.statusFailed')
    }
  }

  return (
    <section className="mt-8" data-cy="kb-resource-list">
      <H3>{t('kb.resourcesTitle')}</H3>
      {resources.length === 0 ? (
        <UserNotification
          type="info"
          message={t('kb.noResources')}
          className={{ root: 'mt-2' }}
        />
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
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <Badge
                  variant="outline"
                  data-cy={`kb-resource-status-${resource.id}`}
                >
                  {statusLabel(resource.status)}
                </Badge>
                <span>
                  {t('kb.updatedAt', {
                    date: format.dateTime(new Date(resource.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
                </span>
              </div>
              <Button
                destructive
                onClick={() => setDeletionTarget(resource)}
                data={{ cy: `delete-kb-resource-${resource.id}` }}
              >
                <Button.Label>{t('shared.generic.delete')}</Button.Label>
              </Button>
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
