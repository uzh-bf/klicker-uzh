import { useQuery } from '@apollo/client'
import { GetKbDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2, Skeleton, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useState } from 'react'
import KnowledgeBaseChatbotBindings from './components/KnowledgeBaseChatbotBindings'
import KnowledgeBaseFileDropzone from './components/KnowledgeBaseFileDropzone'
import KnowledgeBaseResourceList from './components/KnowledgeBaseResourceList'
import KnowledgeBaseUrlForm from './components/KnowledgeBaseUrlForm'
import KnowledgeGraphPanel from './components/KnowledgeGraphPanel'
import { getGraphQLErrorCode } from './graphqlError'

function KnowledgeBaseDetail({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const format = useFormatter()
  const [resourceRefreshKey, setResourceRefreshKey] = useState(0)
  const { data, loading, error, refetch } = useQuery(GetKbDocument, {
    variables: { id: kbId },
  })

  if (loading) {
    return (
      <div
        className="mx-auto w-full max-w-5xl space-y-4"
        data-cy="knowledge-base-detail-loading"
        role="status"
        aria-label={t('shared.generic.loading')}
      >
        <Skeleton
          className="h-10 w-1/2 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="grid gap-4 md:grid-cols-2">
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
          className="h-28 w-full motion-reduce:animate-none"
          aria-hidden="true"
        />
      </div>
    )
  }

  if (error || !data?.getKb) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <UserNotification
          type="error"
          message={
            getGraphQLErrorCode(error) === 'KB_PREVIEW_ACCESS_REQUIRED'
              ? t('kb.previewAccessError')
              : t('kb.notFound')
          }
          data={{ cy: 'knowledge-base-detail-error' }}
        />
      </div>
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
    <div className="mx-auto w-full max-w-5xl" data-cy="knowledge-base-detail">
      <Link
        href="/resources/knowledgeBases"
        className="text-primary-100 hover:underline"
        data-cy="back-to-knowledge-bases"
      >
        {t('kb.backToList')}
      </Link>
      <H2 className={{ root: 'mt-4 break-words' }}>{data.getKb.name}</H2>
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
          <h3
            id="kb-metrics-title"
            className="text-lg font-semibold text-slate-900"
          >
            {t('kb.metricsTitle')}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-600">
                {t('kb.metricVisibleResources')}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {format.number(metrics.visibleResourceCount)}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  / {format.number(metrics.resourceLimit)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t('kb.metricReservedResources', {
                  count: metrics.reservedResourceCount,
                })}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-600">
                {t('kb.metricStorage')}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {formatFileSize(metrics.quotaSizeBytes)}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  / {formatFileSize(metrics.storageLimitBytes)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {metrics.unknownSizeResourceCount > 0
                  ? t('kb.unknownSizesReserved', {
                      count: metrics.unknownSizeResourceCount,
                    })
                  : t('kb.metricStorageBreakdown', {
                      visible: formatFileSize(metrics.visibleSizeBytes),
                      reserved: formatFileSize(metrics.reservedSizeBytes),
                    })}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-600">
                {t('kb.metricPendingCleanup')}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {format.number(metrics.pendingCleanupCount)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t('kb.metricPendingCleanupSize', {
                  size: formatFileSize(metrics.pendingCleanupSizeBytes),
                })}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-600">
                {t('kb.metricLinkedConsumers')}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {format.number(metrics.linkedConsumerCount)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t('kb.metricQuotaResources', {
                  count: metrics.quotaResourceCount,
                })}
              </p>
            </div>
          </div>
          {metrics.pendingCleanupCount > 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              {t('kb.quotaReleaseMessage')}
            </p>
          ) : null}
        </section>
      ) : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <KnowledgeBaseFileDropzone
          kbId={kbId}
          onResourceCreated={handleResourceCreated}
        />
        <KnowledgeBaseUrlForm
          kbId={kbId}
          onResourceCreated={handleResourceCreated}
        />
      </div>
      <KnowledgeBaseChatbotBindings kbId={kbId} onChanged={refreshMetrics} />
      <KnowledgeGraphPanel kbId={kbId} />
      <KnowledgeBaseResourceList
        kbId={kbId}
        refreshKey={resourceRefreshKey}
        onMetricsChanged={refreshMetrics}
      />
    </div>
  )
}

export default KnowledgeBaseDetail
