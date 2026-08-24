import { useQuery } from '@apollo/client'
import { GetKbDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1, Skeleton, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useRef, useState } from 'react'
import KnowledgeBaseAddResourceModal from './components/KnowledgeBaseAddResourceModal'
import KnowledgeBaseChatbotBindings from './components/KnowledgeBaseChatbotBindings'
import KnowledgeBaseResourceList from './components/KnowledgeBaseResourceList'
import KnowledgeGraphPanel from './components/KnowledgeGraphPanel'
import { getGraphQLErrorCode } from './graphqlError'

function KnowledgeBaseDetail({ kbId }: { kbId: string }) {
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
      <H1 className={{ root: 'mt-4 break-words' }}>{data.getKb.name}</H1>
      {data.getKb.description ? (
        <p className="mt-2 break-words text-slate-600">
          {data.getKb.description}
        </p>
      ) : null}
      {metrics ? (
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
        refreshKey={resourceRefreshKey}
        onMetricsChanged={refreshMetrics}
        onAddResource={(trigger) => {
          addResourceTriggerRef.current = trigger
          setAddResourceOpen(true)
        }}
      />
      <details className="mt-6" data-cy="kb-chatbot-settings">
        <summary className="cursor-pointer rounded-md border border-slate-200 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2">
          <span
            className="font-semibold text-slate-900"
            role="heading"
            aria-level={2}
          >
            {t('kb.chatbotsTitle')}
          </span>
        </summary>
        <KnowledgeBaseChatbotBindings
          kbId={kbId}
          compact
          onChanged={refreshMetrics}
        />
      </details>
      <details className="mt-4" data-cy="kb-graph-settings">
        <summary className="cursor-pointer rounded-md border border-slate-200 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2">
          <span
            className="font-semibold text-slate-900"
            role="heading"
            aria-level={2}
          >
            {t('kb.graphTitle')}
          </span>
        </summary>
        <KnowledgeGraphPanel kbId={kbId} compact />
      </details>
      {addResourceOpen ? (
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
