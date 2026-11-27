import { useQuery } from '@apollo/client'
import { GetKbDocument, PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, Skeleton, UserNotification } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useRef, useState } from 'react'
import KnowledgeBaseAddResourceModal from './components/KnowledgeBaseAddResourceModal'
import KnowledgeBaseChatbotBindings from './components/KnowledgeBaseChatbotBindings'
import KnowledgeBaseDomainSettings from './components/KnowledgeBaseDomainSettings'
import KnowledgeBaseImportedSourceList from './components/KnowledgeBaseImportedSourceList'
import KnowledgeBaseQuestionReadiness from './components/KnowledgeBaseQuestionReadiness'
import KnowledgeBaseResourceList from './components/KnowledgeBaseResourceList'
import KnowledgeGraphPanel from './components/KnowledgeGraphPanel'
import { getGraphQLErrorCode } from './graphqlError'

function KnowledgeBaseDetail({
  kbId,
  backLink,
  advanced = false,
  onShare,
}: {
  kbId: string
  // Advanced mode adds usage and quota figures, resource search and filters,
  // the bulk ingestion action, the indexed sources and the knowledge graph
  // panel. The simple page keeps what a lecturer needs to describe the
  // materials, add them and see that they are ready.
  advanced?: boolean
  // A banner leading back, for example to the chatbot whose materials are
  // being prepared. The caller owns and validates the target.
  backLink?: { href: string; label: string; message: string }
  onShare?: (knowledgeBase: { id: string; name: string }) => void
}) {
  const t = useTranslations()
  const format = useFormatter()
  const [resourceRefreshKey, setResourceRefreshKey] = useState(0)
  const [addResourceOpen, setAddResourceOpen] = useState(false)
  const addResourceTriggerRef = useRef<HTMLElement | null>(null)
  const { data, loading, error, refetch } = useQuery(GetKbDocument, {
    variables: { id: kbId },
  })

  if (loading) {
    return (
      <main
        className="mx-auto w-full max-w-5xl space-y-4"
        data-cy="knowledge-base-detail-loading"
        aria-busy="true"
      >
        <H1>{t('kb.detailFallbackTitle')}</H1>
        <div role="status" aria-label={t('shared.generic.loading')}>
          <Skeleton
            className="h-10 w-1/2 motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Skeleton
              className="h-48 w-full motion-reduce:animate-none"
              aria-hidden="true"
            />
            <Skeleton
              className="h-48 w-full motion-reduce:animate-none"
              aria-hidden="true"
            />
          </div>
          <Skeleton
            className="mt-4 h-28 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      </main>
    )
  }

  if (error || !data?.getKb) {
    return (
      <main className="mx-auto w-full max-w-5xl">
        <H1>{t('kb.detailFallbackTitle')}</H1>
        <UserNotification
          type="error"
          message={
            getGraphQLErrorCode(error) === 'KB_PREVIEW_ACCESS_REQUIRED'
              ? t('kb.previewAccessError')
              : t('kb.notFound')
          }
          data={{ cy: 'knowledge-base-detail-error' }}
        />
      </main>
    )
  }

  const metrics = data.getKb.metrics
  const permissionLevel = data.getKb.permissionLevel
  const canWrite =
    permissionLevel === PermissionLevel.Write ||
    permissionLevel === PermissionLevel.Admin ||
    permissionLevel === PermissionLevel.Owner
  const canManageAccess =
    permissionLevel === PermissionLevel.Admin ||
    permissionLevel === PermissionLevel.Owner
  const isOwner = permissionLevel === PermissionLevel.Owner
  const formatFileSize = (sizeBytes: number) => {
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
  const refreshMetrics = () => refetch()
  const handleResourceCreated = async () => {
    setResourceRefreshKey((current) => current + 1)
    await refreshMetrics()
  }

  return (
    <main className="mx-auto w-full max-w-5xl" data-cy="knowledge-base-detail">
      <Link
        href="/resources/knowledgeBases"
        className="text-primary-100 hover:underline"
        data-cy="back-to-knowledge-bases"
      >
        {t('kb.backToList')}
      </Link>
      {backLink ? (
        <div
          className="mt-4 flex flex-col gap-3 rounded-md border border-primary-40 bg-primary-20/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          data-cy="kb-chatbot-banner"
        >
          <p className="text-sm text-slate-800">{backLink.message}</p>
          <Link
            href={backLink.href}
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary-100 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-80"
            data-cy="kb-back-to-chatbot"
          >
            {backLink.label}
          </Link>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <H1 className={{ root: 'min-w-0 break-words' }}>{data.getKb.name}</H1>
        {onShare && canManageAccess ? (
          <Button
            onClick={() =>
              onShare({ id: data.getKb.id, name: data.getKb.name })
            }
            data={{ cy: 'share-knowledge-base-detail' }}
          >
            <Button.Label>{t('manage.sharing.shareKB')}</Button.Label>
          </Button>
        ) : null}
      </div>
      {data.getKb.description ? (
        <p className="mt-2 break-words text-slate-600">
          {data.getKb.description}
        </p>
      ) : null}
      <KnowledgeBaseDomainSettings
        kbId={kbId}
        canEdit={isOwner}
        domain={{
          id: data.getKb.domainPolicyId ?? null,
          version: data.getKb.domainPolicyVersion ?? null,
          language: data.getKb.domainPolicyLanguage ?? null,
        }}
      />
      {data.getKb.questionPreparation ? (
        <div className="mt-3">
          <KnowledgeBaseQuestionReadiness
            preparation={data.getKb.questionPreparation}
          />
        </div>
      ) : null}
      {advanced && isOwner && metrics ? (
        <section
          className="mt-6"
          aria-labelledby="kb-metrics-title"
          data-cy="kb-metrics"
        >
          <h2
            id="kb-metrics-title"
            className="text-lg font-semibold text-slate-900"
          >
            {t('kb.metricsTitle')}
          </h2>
          <dl className="mt-3 grid gap-x-6 gap-y-1 border-y border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 py-3">
              <dt className="text-sm text-slate-600">
                {t('kb.metricVisibleResources')}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">
                {format.number(metrics.visibleResourceCount)}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  / {format.number(metrics.resourceLimit)}
                </span>
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                {t('kb.metricReservedResources', {
                  count: metrics.reservedResourceCount,
                })}
              </dd>
            </div>
            <div className="min-w-0 py-3">
              <dt className="text-sm text-slate-600">
                {t('kb.metricStorage')}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">
                {formatFileSize(metrics.quotaSizeBytes)}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  / {formatFileSize(metrics.storageLimitBytes)}
                </span>
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                {metrics.unknownSizeResourceCount > 0
                  ? t('kb.unknownSizesReserved', {
                      count: metrics.unknownSizeResourceCount,
                    })
                  : t('kb.metricStorageBreakdown', {
                      visible: formatFileSize(metrics.visibleSizeBytes),
                      reserved: formatFileSize(metrics.reservedSizeBytes),
                    })}
              </dd>
            </div>
            <div className="min-w-0 py-3">
              <dt className="text-sm text-slate-600">
                {t('kb.metricPendingCleanup')}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">
                {format.number(metrics.pendingCleanupCount)}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                {t('kb.metricPendingCleanupSize', {
                  size: formatFileSize(metrics.pendingCleanupSizeBytes),
                })}
              </dd>
            </div>
            <div className="min-w-0 py-3">
              <dt className="text-sm text-slate-600">
                {t('kb.metricLinkedConsumers')}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">
                {format.number(metrics.linkedConsumerCount)}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                {t('kb.metricQuotaResources', {
                  count: metrics.quotaResourceCount,
                })}
              </dd>
            </div>
          </dl>
          {metrics.pendingCleanupCount > 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              {t('kb.quotaReleaseMessage')}
            </p>
          ) : null}
        </section>
      ) : null}
      <KnowledgeBaseResourceList
        kbId={kbId}
        canWrite={canWrite}
        refreshKey={resourceRefreshKey}
        onMetricsChanged={refreshMetrics}
        advanced={advanced}
        onAddResource={(trigger) => {
          addResourceTriggerRef.current = trigger
          setAddResourceOpen(true)
        }}
      />
      {advanced ? <KnowledgeBaseImportedSourceList kbId={kbId} /> : null}
      {isOwner ? (
        <KnowledgeBaseChatbotBindings kbId={kbId} onChanged={refreshMetrics} />
      ) : null}
      {advanced && isOwner ? <KnowledgeGraphPanel kbId={kbId} /> : null}
      {canWrite && addResourceOpen ? (
        <KnowledgeBaseAddResourceModal
          kbId={kbId}
          triggerRef={addResourceTriggerRef}
          onClose={() => setAddResourceOpen(false)}
          onResourceCreated={handleResourceCreated}
        />
      ) : null}
    </main>
  )
}

export default KnowledgeBaseDetail
