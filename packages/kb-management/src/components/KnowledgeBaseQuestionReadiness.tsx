import type { GetUserKbsQuery } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import React from 'react'

const SUPPORT_EMAIL = 'klicker@df.uzh.ch'

type QuestionPreparation = NonNullable<
  GetUserKbsQuery['getUserKbsConnection']['items'][number]['questionPreparation']
>

/**
 * Whether questions can be generated from a knowledge base. It is separate
 * from the chatbot materials readiness. A ready knowledge base without a
 * usable basis cannot be fixed by waiting, so it needs attention.
 */
function KnowledgeBaseQuestionReadiness({
  preparation,
  showContact = true,
}: {
  preparation:
    | Pick<QuestionPreparation, 'state' | 'hasBasis'>
    | null
    | undefined
  showContact?: boolean
}) {
  const t = useTranslations()
  if (!preparation) return null

  const state =
    preparation.state === 'READY' && !preparation.hasBasis
      ? 'NEEDS_ATTENTION'
      : preparation.state
  const needsContact =
    showContact &&
    (state === 'DELAYED' ||
      state === 'NEEDS_ATTENTION' ||
      state === 'UNAVAILABLE')

  return (
    <span
      className={`block text-xs ${
        state === 'NEEDS_ATTENTION' ? 'text-red-700' : 'text-slate-500'
      }`}
      data-cy="kb-question-readiness"
      data-state={state}
    >
      {t(`kb.questionReadiness.${state}`)}
      {needsContact ? (
        <>
          {' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline"
            data-cy="kb-question-readiness-contact"
          >
            {t('kb.questionReadiness.contact')}
          </a>
        </>
      ) : null}
    </span>
  )
}

export default KnowledgeBaseQuestionReadiness
