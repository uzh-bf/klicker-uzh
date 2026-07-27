import { useQuery } from '@apollo/client'
import { GetKbDocument, KbResourceStatus } from '@klicker-uzh/graphql/dist/ops'
import { H2, Skeleton, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import KnowledgeBaseChatbotBindings from './components/KnowledgeBaseChatbotBindings'
import KnowledgeBaseFileDropzone from './components/KnowledgeBaseFileDropzone'
import KnowledgeBaseResourceList from './components/KnowledgeBaseResourceList'
import KnowledgeBaseUrlForm from './components/KnowledgeBaseUrlForm'

function KnowledgeBaseDetail({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const [anyActive, setAnyActive] = useState(false)
  const { data, loading, error } = useQuery(GetKbDocument, {
    variables: { id: kbId },
    pollInterval: anyActive ? 2000 : 0,
  })
  const hasActiveResources =
    data?.getKb.resources.some(
      (resource) =>
        resource.status === KbResourceStatus.Queued ||
        resource.status === KbResourceStatus.Processing
    ) ?? false

  useEffect(() => {
    setAnyActive(hasActiveResources)
  }, [hasActiveResources])

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
          message={t('kb.notFound')}
          data={{ cy: 'knowledge-base-detail-error' }}
        />
      </div>
    )
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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <KnowledgeBaseFileDropzone kbId={kbId} />
        <KnowledgeBaseUrlForm kbId={kbId} />
      </div>
      <KnowledgeBaseChatbotBindings kbId={kbId} />
      <KnowledgeBaseResourceList kbId={kbId} resources={data.getKb.resources} />
    </div>
  )
}

export default KnowledgeBaseDetail
