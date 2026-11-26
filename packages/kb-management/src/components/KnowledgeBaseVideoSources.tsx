import { useQuery } from '@apollo/client'
import {
  GetKbVideoSourcesDocument,
  KbVideoSourceStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useEffect } from 'react'

// Status of the lecture video sources submitted for this knowledge base.
function KnowledgeBaseVideoSources({
  kbId,
  refreshKey,
}: {
  kbId: string
  refreshKey: number
}) {
  const t = useTranslations()
  const format = useFormatter()
  const { data, refetch } = useQuery(GetKbVideoSourcesDocument, {
    variables: { kbId },
    fetchPolicy: 'cache-and-network',
  })
  // Re-query after a submission from the add-resource dialog.
  useEffect(() => {
    if (refreshKey > 0) void refetch()
  }, [refreshKey, refetch])
  const sources = data?.getKbVideoSources ?? []
  if (sources.length === 0) return null

  const statusText = (source: (typeof sources)[number]) => {
    const request = source.requests[0]
    switch (source.status) {
      case KbVideoSourceStatus.Submitted:
      case KbVideoSourceStatus.Verified:
        return t('kb.videoStatusSUBMITTED')
      case KbVideoSourceStatus.Rejected:
        return t('kb.videoStatusREJECTED', {
          reason: source.rejectionReason ?? '–',
        })
      case KbVideoSourceStatus.PendingApproval:
        return t('kb.videoStatusPENDING_APPROVAL', {
          count: request?.recipients.length ?? 0,
        })
      case KbVideoSourceStatus.AwaitingAdmin:
        return t('kb.videoStatusAWAITING_ADMIN')
      case KbVideoSourceStatus.Approved:
        return t('kb.videoStatusAPPROVED', {
          date: source.validUntil
            ? format.dateTime(new Date(source.validUntil), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '–',
        })
      default:
        return t(`kb.videoStatus${source.status}`)
    }
  }

  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-cy="kb-video-sources"
    >
      <H3>{t('kb.videoSourcesTitle')}</H3>
      <ul className="mt-3 divide-y divide-slate-100">
        {sources.map((source) => (
          <li
            key={source.id}
            className="py-2 text-sm"
            data-cy={`kb-video-source-${source.id}`}
          >
            <div className="font-semibold text-slate-900">{source.name}</div>
            <div className="text-slate-600">{statusText(source)}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default KnowledgeBaseVideoSources
