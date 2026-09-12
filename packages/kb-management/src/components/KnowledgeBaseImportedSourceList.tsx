import { NetworkStatus, useQuery } from '@apollo/client'
import {
  GetKbImportedSourcesDocument,
  type GetKbImportedSourcesQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  Skeleton,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useState } from 'react'

const PAGE_SIZE = 20

type ImportedSource =
  GetKbImportedSourcesQuery['getKbImportedSources']['items'][number]

// The inventory only records observed public links, but the rendered href is
// restricted to credential-free http(s) URLs without query or fragment so a
// malformed or signed value can never become an active or replayable link in
// the management UI.
function getSafeSourceLink(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return null

  try {
    const url = new URL(sourceUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username !== '' || url.password !== '') return null
    if (url.search !== '' || url.hash !== '') return null
    return url
  } catch {
    return null
  }
}

function getSourceTypeLabel(sourceType: string | null | undefined) {
  if (!sourceType || sourceType.trim() === '') return null
  return sourceType.charAt(0).toUpperCase() + sourceType.slice(1)
}

function ImportedSourceRow({ source }: { source: ImportedSource }) {
  const t = useTranslations()
  const format = useFormatter()
  const sourceLink = getSafeSourceLink(source.sourceUrl)
  const typeLabel = getSourceTypeLabel(source.sourceType)

  return (
    <li
      className="rounded-md border border-slate-200 bg-white p-4"
      data-cy={`kb-imported-source-${source.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="break-words font-medium text-slate-900">
          {source.title}
        </span>
        <Badge
          variant="outline"
          data-cy={`kb-imported-source-type-${source.id}`}
        >
          {typeLabel ?? t('kb.importedSourceGeneric')}
        </Badge>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        {source.observedAt ? (
          <time
            dateTime={new Date(source.observedAt).toISOString()}
            data-cy={`kb-imported-source-observed-${source.id}`}
          >
            {t('kb.importedObservedAt', {
              date: format.dateTime(new Date(source.observedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </time>
        ) : null}
        <span data-cy={`kb-imported-source-ingested-${source.id}`}>
          {source.ingestedAt
            ? t('kb.importedIngestedAt', {
                date: format.dateTime(new Date(source.ingestedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })
            : t('kb.importedIngestionUnknown')}
        </span>
      </div>
      {sourceLink ? (
        <a
          href={sourceLink.toString()}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary-100 mt-2 inline-block break-all text-xs hover:underline"
          data-cy={`kb-imported-source-link-${source.id}`}
        >
          {sourceLink.host}
        </a>
      ) : null}
      {source.sourceType?.toLowerCase() === 'video' ? (
        <p
          className="mt-1 text-xs text-slate-500"
          data-cy={`kb-imported-source-video-hint-${source.id}`}
        >
          {t('kb.importedVideoNoFileHint')}
        </p>
      ) : null}
    </li>
  )
}

function KnowledgeBaseImportedSourceList({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const [loadMoreFailed, setLoadMoreFailed] = useState(false)
  const { data, loading, error, fetchMore, networkStatus } = useQuery(
    GetKbImportedSourcesDocument,
    {
      variables: { kbId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
    }
  )
  const connection = data?.getKbImportedSources
  const sources = connection?.items ?? []
  const loadingMore = networkStatus === NetworkStatus.fetchMore

  const loadMore = async () => {
    if (!connection?.pageInfo.hasNextPage || loadingMore) return

    setLoadMoreFailed(false)
    try {
      await fetchMore({
        variables: { after: connection.pageInfo.endCursor },
        updateQuery: (previous, { fetchMoreResult }) => ({
          ...fetchMoreResult,
          getKbImportedSources: {
            ...fetchMoreResult.getKbImportedSources,
            items: [
              ...previous.getKbImportedSources.items,
              ...fetchMoreResult.getKbImportedSources.items,
            ],
          },
        }),
      })
    } catch (loadMoreError) {
      // A rejected page keeps the already loaded rows usable; the load-more
      // button stays visible and retries the same cursor on the next click.
      console.error('Failed to load more imported sources', loadMoreError)
      setLoadMoreFailed(true)
    }
  }

  return (
    <section
      className="mt-8"
      aria-labelledby="kb-imported-sources-title"
      data-cy="kb-imported-sources"
    >
      <h2
        id="kb-imported-sources-title"
        className="text-lg font-semibold text-slate-900"
      >
        {t('kb.importedSourcesTitle')}
      </h2>
      <UserNotification
        type="info"
        className={{ root: 'mt-3' }}
        message={t('kb.importedSourcesNotice')}
        data={{ cy: 'kb-imported-sources-notice' }}
      />
      {connection?.incomplete ? (
        <UserNotification
          type="info"
          className={{ root: 'mt-3' }}
          message={t('kb.importedSourcesIncomplete')}
          data={{ cy: 'kb-imported-sources-incomplete' }}
        />
      ) : null}
      {loading && !connection ? (
        <div
          className="mt-3"
          role="status"
          aria-label={t('shared.generic.loading')}
          data-cy="kb-imported-sources-loading"
        >
          <Skeleton
            className="h-20 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      ) : error && !connection ? (
        <UserNotification
          type="error"
          className={{ root: 'mt-3' }}
          message={t('kb.importedSourcesLoadError')}
          data={{ cy: 'kb-imported-sources-error' }}
        />
      ) : sources.length === 0 ? (
        <p
          className="mt-3 text-sm text-slate-600"
          data-cy="kb-imported-sources-empty"
        >
          {t('kb.importedSourcesEmpty')}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {sources.map((source) => (
              <ImportedSourceRow key={source.id} source={source} />
            ))}
          </ul>
          {loadMoreFailed ? (
            <UserNotification
              type="error"
              className={{ root: 'mt-4' }}
              message={t('kb.importedSourcesLoadMoreError')}
              data={{ cy: 'kb-imported-sources-load-more-error' }}
            />
          ) : null}
          {connection?.pageInfo.hasNextPage ? (
            <div className="mt-5 flex justify-center">
              <Button
                onClick={loadMore}
                loading={loadingMore}
                disabled={loadingMore}
                data={{ cy: 'load-more-imported-sources' }}
              >
                <Button.Label>{t('kb.loadMoreImportedSources')}</Button.Label>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default KnowledgeBaseImportedSourceList
