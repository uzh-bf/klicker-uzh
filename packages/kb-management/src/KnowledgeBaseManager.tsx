import { useQuery } from '@apollo/client'
import {
  GetUserKbsDocument,
  type GetUserKbsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H2,
  H3,
  Skeleton,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useState } from 'react'
import CreateKnowledgeBaseModal from './components/CreateKnowledgeBaseModal'
import DeleteKnowledgeBaseModal from './components/DeleteKnowledgeBaseModal'

type KnowledgeBaseSummary = GetUserKbsQuery['getUserKbs'][number]

function KnowledgeBaseManager() {
  const t = useTranslations()
  const [createOpen, setCreateOpen] = useState(false)
  const [deletionTarget, setDeletionTarget] =
    useState<KnowledgeBaseSummary | null>(null)
  const { data, loading, error } = useQuery(GetUserKbsDocument)
  const knowledgeBases = data?.getUserKbs ?? []

  return (
    <div className="mx-auto w-full max-w-5xl" data-cy="knowledge-base-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <H2>{t('kb.title')}</H2>
        <Button
          primary
          onClick={() => setCreateOpen(true)}
          data={{ cy: 'create-knowledge-base' }}
        >
          <Button.Label>{t('kb.create')}</Button.Label>
        </Button>
      </div>

      {loading ? (
        <div
          className="mt-6 space-y-3"
          data-cy="knowledge-base-loading"
          role="status"
          aria-label={t('shared.generic.loading')}
        >
          <Skeleton
            className="h-20 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
          <Skeleton
            className="h-20 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      ) : error ? (
        <UserNotification
          type="error"
          message={t('kb.loadError')}
          data={{ cy: 'knowledge-base-error' }}
          className={{ root: 'mt-6' }}
        />
      ) : knowledgeBases.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-slate-300 p-8 text-center">
          <H3>{t('kb.emptyTitle')}</H3>
          <p className="mt-2 text-slate-600">{t('kb.emptyDescription')}</p>
          <Button
            primary
            onClick={() => setCreateOpen(true)}
            data={{ cy: 'create-knowledge-base-empty' }}
            className={{ root: 'mt-4' }}
          >
            <Button.Label>{t('kb.create')}</Button.Label>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {knowledgeBases.map((kb) => (
            <li
              key={kb.id}
              className="flex items-stretch overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
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
              </Link>
              <div className="flex items-center border-l border-slate-200 px-3">
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
      )}

      {createOpen ? (
        <CreateKnowledgeBaseModal onClose={() => setCreateOpen(false)} />
      ) : null}
      {deletionTarget ? (
        <DeleteKnowledgeBaseModal
          knowledgeBase={deletionTarget}
          onClose={() => setDeletionTarget(null)}
        />
      ) : null}
    </div>
  )
}

export default KnowledgeBaseManager
