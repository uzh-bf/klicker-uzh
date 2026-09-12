import { NetworkStatus, useQuery } from '@apollo/client'
import {
  GetUserKbsDocument,
  type GetUserKbsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H1,
  H3,
  Skeleton,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useDeferredValue, useState } from 'react'
import CreateKnowledgeBaseModal from './components/CreateKnowledgeBaseModal'
import DeleteKnowledgeBaseModal from './components/DeleteKnowledgeBaseModal'
import { getGraphQLErrorCode } from './graphqlError'

const PAGE_SIZE = 20

type KnowledgeBaseSummary =
  GetUserKbsQuery['getUserKbsConnection']['items'][number]

function KnowledgeBaseManager() {
  const t = useTranslations()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [deletionTarget, setDeletionTarget] =
    useState<KnowledgeBaseSummary | null>(null)
  const { data, loading, error, fetchMore, refetch, networkStatus } = useQuery(
    GetUserKbsDocument,
    {
      variables: {
        first: PAGE_SIZE,
        search: deferredSearch || null,
      },
      notifyOnNetworkStatusChange: true,
    }
  )
  const connection = data?.getUserKbsConnection
  const knowledgeBases = connection?.items ?? []
  const loadingMore = networkStatus === NetworkStatus.fetchMore

  const loadMore = async () => {
    if (!connection?.pageInfo.hasNextPage || loadingMore) return
    await fetchMore({
      variables: { after: connection.pageInfo.endCursor },
      updateQuery: (previous, { fetchMoreResult }) => ({
        ...fetchMoreResult,
        getUserKbsConnection: {
          ...fetchMoreResult.getUserKbsConnection,
          items: [
            ...previous.getUserKbsConnection.items,
            ...fetchMoreResult.getUserKbsConnection.items,
          ],
        },
      }),
    })
  }

  return (
    <main className="mx-auto w-full max-w-5xl" data-cy="knowledge-base-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <H1>{t('kb.title')}</H1>
        <Button
          primary
          onClick={() => setCreateOpen(true)}
          data={{ cy: 'create-knowledge-base' }}
        >
          <Button.Label>{t('kb.create')}</Button.Label>
        </Button>
      </div>

      <div className="mt-6 max-w-xl">
        <TextField
          id="knowledge-base-search"
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={setSearch}
          label={t('kb.searchKnowledgeBases')}
          placeholder={t('kb.searchKnowledgeBasesPlaceholder')}
          data={{ cy: 'knowledge-base-search' }}
        />
      </div>

      {loading && !connection ? (
        <div
          className="mt-6 space-y-3"
          data-cy="knowledge-base-loading"
          role="status"
          aria-label={t('shared.generic.loading')}
        >
          <Skeleton
            className="h-24 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
          <Skeleton
            className="h-24 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      ) : error ? (
        <UserNotification
          type="error"
          message={
            getGraphQLErrorCode(error) === 'KB_PREVIEW_ACCESS_REQUIRED'
              ? t('kb.previewAccessError')
              : t('kb.loadError')
          }
          data={{ cy: 'knowledge-base-error' }}
          className={{ root: 'mt-6' }}
        />
      ) : knowledgeBases.length === 0 ? (
        <div
          className="mt-6 rounded-md border border-dashed border-slate-300 p-8 text-center"
          data-cy="knowledge-base-empty"
        >
          <H3>
            {deferredSearch ? t('kb.noSearchResults') : t('kb.emptyTitle')}
          </H3>
          <p className="mt-2 text-slate-600">
            {deferredSearch
              ? t('kb.noSearchResultsDescription')
              : t('kb.emptyDescription')}
          </p>
          {!deferredSearch ? (
            <Button
              primary
              onClick={() => setCreateOpen(true)}
              data={{ cy: 'create-knowledge-base-empty' }}
              className={{ root: 'mt-4' }}
            >
              <Button.Label>{t('kb.create')}</Button.Label>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p
            className="mt-6 text-sm text-slate-600"
            aria-live="polite"
            data-cy="knowledge-base-result-count"
          >
            {t('kb.searchResultCount', {
              count: connection?.totalCount ?? 0,
            })}
          </p>
          <ul className="mt-3 space-y-3">
            {knowledgeBases.map((kb) => (
              <li
                key={kb.id}
                className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-stretch"
              >
                <Link
                  href={`/resources/knowledgeBases/${kb.id}`}
                  className="min-w-0 flex-1 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  data-cy={`knowledge-base-row-${kb.id}`}
                >
                  <span className="block truncate font-medium text-slate-900">
                    {kb.name}
                  </span>
                  <span className="mt-1 block truncate text-sm text-slate-600">
                    {kb.description || t('kb.noDescription')}
                  </span>
                  {kb.metrics ? (
                    <span className="mt-2 block text-xs text-slate-500">
                      {t('kb.catalogMetrics', {
                        resources: kb.metrics.visibleResourceCount,
                        chatbots: kb.metrics.linkedConsumerCount,
                      })}
                    </span>
                  ) : null}
                </Link>
                <div className="flex items-center justify-end border-t border-slate-200 px-3 py-2 sm:border-l sm:border-t-0 sm:py-0">
                  <Button
                    destructive
                    onClick={() => setDeletionTarget(kb)}
                    data={{ cy: `delete-knowledge-base-${kb.id}` }}
                  >
                    <Button.Label>{t('shared.generic.delete')}</Button.Label>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {connection?.pageInfo.hasNextPage ? (
            <div className="mt-5 flex justify-center">
              <Button
                onClick={loadMore}
                loading={loadingMore}
                disabled={loadingMore}
                data={{ cy: 'load-more-knowledge-bases' }}
              >
                <Button.Label>{t('kb.loadMore')}</Button.Label>
              </Button>
            </div>
          ) : null}
        </>
      )}

      {createOpen ? (
        <CreateKnowledgeBaseModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => refetch()}
        />
      ) : null}
      {deletionTarget ? (
        <DeleteKnowledgeBaseModal
          knowledgeBase={deletionTarget}
          onClose={() => setDeletionTarget(null)}
          onDeleted={() => refetch()}
        />
      ) : null}
    </main>
  )
}

export default KnowledgeBaseManager
