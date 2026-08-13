import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-solid-svg-icons'
import {
  GetLiveQuizEmbeddingInfoDocument,
  GetSingleLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'

function HMACLink({
  quizId,
  hmac,
  params,
  identifier,
}: {
  quizId: string
  hmac: string
  params: string
  identifier: string
}) {
  const link = `${
    process.env.NEXT_PUBLIC_MANAGE_URL
  }/quizzes/${quizId}/evaluation?hmac=${hmac}${params ? `&${params}` : ''}`

  return (
    <div className="bg-accent flex max-w-full flex-row items-center justify-between gap-3 rounded px-2 py-1">
      <Link
        href={link}
        data-cy={`open-embedding-link-${identifier}`}
        className="max-w-[calc(100%-3.5rem)] break-words text-sm"
        target="_blank"
        rel="noopener noreferrer"
      >
        {link}
      </Link>
      <Button
        onClick={() => navigator?.clipboard?.writeText(link)}
        data={{ cy: `copy-embed-link-live-quiz-${quizId}` }}
      >
        <Button.Icon withoutLabel icon={faClipboard} />
      </Button>
    </div>
  )
}

function EmbeddingModal({
  onClose,
  quizId,
}: {
  onClose: () => void
  quizId: string
}) {
  const t = useTranslations()
  const { data: dataLiveQuiz } = useQuery(GetSingleLiveQuizDocument, {
    variables: { quizId: quizId || '' },
    skip: !quizId,
  })

  const { data, loading } = useQuery(GetLiveQuizEmbeddingInfoDocument, {
    variables: { id: quizId },
    skip: !open,
  })

  const questions = useMemo(
    () =>
      dataLiveQuiz?.liveQuiz?.blocks?.flatMap((block) => block.elements) || [],
    [dataLiveQuiz?.liveQuiz?.blocks]
  )

  return (
    <Modal
      open
      hideCloseButton
      loading={loading}
      onClose={onClose}
      onSecondaryAction={onClose}
      secondaryLabel={t('shared.generic.close')}
      dataSecondaryAction={{ cy: 'close-embedding-modal' }}
    >
      <H2>{t('control.course.pptEmbedding')}</H2>
      <div className="flex flex-col gap-3">
        {questions?.map((element, ix) => {
          if (!element || !element.elementData) return null

          return (
            <div key={element.id}>
              <div className="line-clamp-1 w-full font-bold">{`${ix + 1}. ${
                element.elementData.name
              }`}</div>
              <HMACLink
                quizId={quizId}
                hmac={data?.getLiveQuizEmbeddingInfo?.hmac ?? ''}
                params={`questionIx=${ix}&hideControls=true`}
                identifier={`question-${ix}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-3">
        <div className="w-30 font-bold">{t('shared.generic.leaderboard')}:</div>
        <HMACLink
          quizId={quizId}
          hmac={data?.getLiveQuizEmbeddingInfo?.hmac ?? ''}
          params={`leaderboard=true&hideControls=true`}
          identifier={`leaderboard`}
        />
      </div>
    </Modal>
  )
}

export default EmbeddingModal
