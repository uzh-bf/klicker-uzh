import { useQuery } from '@apollo/client'
import { GetKbDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2, Skeleton, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import KnowledgeBaseFileDropzone from './components/KnowledgeBaseFileDropzone'
import KnowledgeBaseResourceList from './components/KnowledgeBaseResourceList'
import KnowledgeBaseUrlForm from './components/KnowledgeBaseUrlForm'

function KnowledgeBaseDetail({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(GetKbDocument, {
    variables: { id: kbId },
  })

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error || !data?.getKb) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <UserNotification type="error" message={t('kb.notFound')} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl" data-cy="knowledge-base-detail">
      <a
        href="/resources/knowledgeBases"
        className="text-primary-100 hover:underline"
        data-cy="back-to-knowledge-bases"
      >
        {t('kb.backToList')}
      </a>
      <H2 className={{ root: 'mt-4' }}>{data.getKb.name}</H2>
      {data.getKb.description ? (
        <p className="mt-2 text-slate-600">{data.getKb.description}</p>
      ) : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <KnowledgeBaseFileDropzone kbId={kbId} />
        <KnowledgeBaseUrlForm kbId={kbId} />
      </div>
      <KnowledgeBaseResourceList kbId={kbId} resources={data.getKb.resources} />
    </div>
  )
}

export default KnowledgeBaseDetail
