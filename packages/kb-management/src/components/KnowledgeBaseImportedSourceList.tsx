import { NetworkStatus, useQuery } from '@apollo/client'
import { faFileLines, faLink, faVideo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetKbImportedSourcesDocument,
  type GetKbImportedSourcesQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  H2,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCaption,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  Skeleton,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useState } from 'react'

const PAGE_SIZE = 20

type ImportedSource =
  GetKbImportedSourcesQuery['getKbImportedSources']['items'][number]

type ImportedSourceConnection =
  GetKbImportedSourcesQuery['getKbImportedSources']

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

function getSourceTypeIcon(sourceType: string | null | undefined) {
  const type = sourceType?.toLowerCase()
  if (type === 'video') return faVideo
  if (type === 'link') return faLink
  return faFileLines
}

function ImportedSourceRow({ source }: { source: ImportedSource }) {
  const t = useTranslations()
  const format = useFormatter()
  const sourceLink = getSafeSourceLink(source.sourceUrl)
  const typeLabel = getSourceTypeLabel(source.sourceType)
  const isVideo = source.sourceType?.toLowerCase() === 'video'
  const isManaged = source.origin === 'MANAGED'

  return (
    <ShadcnTableRow
      className="bg-white"
      data-cy={`kb-imported-source-${source.id}`}
    >
      <ShadcnTableCell className="whitespace-normal align-top">
        <div className="flex min-w-0 items-start gap-3">
          <FontAwesomeIcon
            icon={getSourceTypeIcon(source.sourceType)}
            className="text-primary-100 mt-1 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-words font-medium">{source.title}</span>
              <Badge
                variant={isManaged ? 'default' : 'outline'}
                data-cy={`kb-imported-source-origin-${source.id}`}
              >
                {isManaged
                  ? t('kb.importedSourceManagedBadge')
                  : t('kb.importedSourceImportedBadge')}
              </Badge>
            </div>
            {sourceLink ? (
              <a
                href={sourceLink.toString()}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary-100 mt-1 inline-block break-all text-xs hover:underline"
                data-cy={`kb-imported-source-link-${source.id}`}
              >
                {sourceLink.host}
              </a>
            ) : null}
            {isVideo ? (
              <p
                className="mt-1 text-xs text-slate-500"
                data-cy={`kb-imported-source-video-hint-${source.id}`}
              >
                {t('kb.importedVideoNoFileHint')}
              </p>
            ) : null}
            {source.observedAt ? (
              <time
                dateTime={new Date(source.observedAt).toISOString()}
                className="mt-1 block text-xs text-slate-500 lg:hidden"
              >
                {t('kb.importedObservedAt', {
                  date: format.dateTime(new Date(source.observedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </time>
            ) : null}
          </div>
        </div>
      </ShadcnTableCell>
      <ShadcnTableCell className="hidden whitespace-normal align-top sm:table-cell">
        <Badge
          variant="outline"
          data-cy={`kb-imported-source-type-${source.id}`}
        >
          {typeLabel ?? t('kb.importedSourceGeneric')}
        </Badge>
      </ShadcnTableCell>
      <ShadcnTableCell className="whitespace-normal align-top">
        <span
          className="text-sm text-slate-600"
          data-cy={`kb-imported-source-ingested-${source.id}`}
        >
          {source.ingestedAt
            ? format.dateTime(new Date(source.ingestedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : t('kb.importedIngestionUnknown')}
        </span>
      </ShadcnTableCell>
      <ShadcnTableCell
        className="hidden whitespace-normal align-top text-sm text-slate-600 lg:table-cell"
        data-cy={`kb-imported-source-observed-${source.id}`}
      >
        {source.observedAt ? (
          <time dateTime={new Date(source.observedAt).toISOString()}>
            {format.dateTime(new Date(source.observedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        ) : (
          <span>—</span>
        )}
      </ShadcnTableCell>
    </ShadcnTableRow>
  )
}

function ImportedSourceTable({
  connection,
  sources,
  loadingMore,
  loadMoreFailed,
  onLoadMore,
}: Readonly<{
  connection: ImportedSourceConnection
  sources: ImportedSource[]
  loadingMore: boolean
  loadMoreFailed: boolean
  onLoadMore: () => void
}>) {
  const t = useTranslations()

  return (
    <>
      <ShadcnTable
        className="mt-3 table-fixed"
        aria-label={t('kb.importedSourcesTitle')}
      >
        <ShadcnTableCaption className="sr-only">
          {t('kb.importedSourcesTitle')}
        </ShadcnTableCaption>
        <ShadcnTableHeader className="bg-slate-50">
          <ShadcnTableRow>
            <ShadcnTableHead className="whitespace-normal" scope="col">
              {t('kb.importedSourceColumn')}
            </ShadcnTableHead>
            <ShadcnTableHead
              className="hidden whitespace-normal sm:table-cell"
              scope="col"
            >
              {t('kb.sourceType')}
            </ShadcnTableHead>
            <ShadcnTableHead className="whitespace-normal" scope="col">
              {t('kb.importedIngestedColumn')}
            </ShadcnTableHead>
            <ShadcnTableHead
              className="hidden whitespace-normal lg:table-cell"
              scope="col"
            >
              {t('kb.importedObservedColumn')}
            </ShadcnTableHead>
          </ShadcnTableRow>
        </ShadcnTableHeader>
        <ShadcnTableBody>
          {sources.map((source) => (
            <ImportedSourceRow key={source.id} source={source} />
          ))}
        </ShadcnTableBody>
      </ShadcnTable>
      {loadMoreFailed ? (
        <UserNotification
          type="error"
          className={{ root: 'mt-4' }}
          message={t('kb.importedSourcesLoadMoreError')}
          data={{ cy: 'kb-imported-sources-load-more-error' }}
        />
      ) : null}
      {connection.pageInfo.hasNextPage ? (
        <div className="mt-5 flex justify-center">
          <Button
            onClick={onLoadMore}
            loading={loadingMore}
            disabled={loadingMore}
            data={{ cy: 'load-more-imported-sources' }}
          >
            <Button.Label>{t('kb.loadMoreImportedSources')}</Button.Label>
          </Button>
        </div>
      ) : null}
    </>
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
            incomplete:
              previous.getKbImportedSources.incomplete ||
              fetchMoreResult.getKbImportedSources.incomplete,
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

  // Only an initial load without a connection maps to the load error. A
  // rejected page keeps the already loaded rows while `error` is set, so
  // pagination failures surface exclusively through the load-more error.
  const renderInventoryBody = () => {
    if (loading && !connection) {
      return (
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
      )
    }
    if (error && !connection) {
      return (
        <UserNotification
          type="error"
          className={{ root: 'mt-3' }}
          message={t('kb.importedSourcesLoadError')}
          data={{ cy: 'kb-imported-sources-error' }}
        />
      )
    }
    if (!connection || sources.length === 0) {
      return (
        <p
          className="mt-3 text-sm text-slate-600"
          data-cy="kb-imported-sources-empty"
        >
          {t('kb.importedSourcesEmpty')}
        </p>
      )
    }
    return (
      <ImportedSourceTable
        connection={connection}
        sources={sources}
        loadingMore={loadingMore}
        loadMoreFailed={loadMoreFailed}
        onLoadMore={loadMore}
      />
    )
  }

  return (
    <section
      className="mt-8"
      aria-labelledby="kb-imported-sources-title"
      data-cy="kb-imported-sources"
    >
      <H2 id="kb-imported-sources-title">{t('kb.importedSourcesTitle')}</H2>
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
      {renderInventoryBody()}
    </section>
  )
}

export default KnowledgeBaseImportedSourceList
