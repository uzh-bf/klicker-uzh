import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { GetLiveQuizHmacDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

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
      <Link href={link} legacyBehavior passHref>
        <a
          data-cy={`open-embedding-link-${identifier}`}
          className="max-w-[calc(100%-3.5rem)] break-words text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          {link}
        </a>
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

interface EmbeddingModalProps {
  open: boolean
  onClose: () => void
  quizId: string
  elements?: { id: number; name: string }[]
}

function EmbeddingModal({
  open,
  onClose,
  quizId,
  elements,
}: EmbeddingModalProps) {
  const t = useTranslations()
  const [showSolution, setShowSolution] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const { data, loading } = useQuery(GetLiveQuizHmacDocument, {
    variables: {
      id: quizId,
    },
    skip: !open,
  })

  return (
    <Modal
      title={t('manage.liveQuizzes.evaluationLinksEmbedding')}
      open={open}
      onClose={onClose}
      className={{ content: 'max-h-[calc(100%-3rem)]' }}
      onPrimaryAction={
        <Button onClick={onClose} data={{ cy: 'close-embedding-modal' }}>
          <Button.Label>{t('shared.generic.close')}</Button.Label>
        </Button>
      }
    >
      <div className="mb-4 rounded-md border py-2 pl-1 pr-2">
        <Switch
          label={t('manage.evaluation.showSolution')}
          checked={showSolution}
          onCheckedChange={(val) => setShowSolution(val)}
        />
        <div className="mb-3 pl-[3.75rem] text-sm">
          {t('manage.evaluation.showSolutionInfo')}
        </div>
        <Switch
          label={t('manage.evaluation.showExplanation')}
          checked={showExplanation}
          onCheckedChange={(val) => setShowExplanation(val)}
        />
        <div className="pl-[3.75rem] text-sm">
          {t('manage.evaluation.showExplanationInfo')}
        </div>
      </div>
      {loading || !data?.liveQuizHMAC ? (
        <Loader />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="w-30 font-bold">
              {t('shared.generic.evaluation')}
            </div>
            <HMACLink
              quizId={quizId}
              hmac={data.liveQuizHMAC!}
              params={``}
              identifier="generic-evaluation"
            />
          </div>
          {elements?.map((element, ix) => {
            return (
              <div key={element.id}>
                <div className="line-clamp-1 font-bold">
                  {ix + 1} {element.name}
                </div>
                <HMACLink
                  quizId={quizId}
                  hmac={data.liveQuizHMAC!}
                  params={`questionIx=${ix}&hideControls=true&showSolution=${showSolution}&showExplanation=${showExplanation}`}
                  identifier={`question-${ix}`}
                />
              </div>
            )
          })}
          <div>
            <div className="w-30 font-bold">
              {t('shared.generic.leaderboard')}:
            </div>
            <HMACLink
              quizId={quizId}
              hmac={data.liveQuizHMAC!}
              params={`leaderboard=true&hideControls=true`}
              identifier={`leaderboard`}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

export default EmbeddingModal
