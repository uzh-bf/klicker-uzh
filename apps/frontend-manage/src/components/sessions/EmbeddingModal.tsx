import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { QuestionInstance } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface EmbeddingModalProps {
  open: boolean
  onClose: () => void
  sessionId: string
  questions?: QuestionInstance[]
}

function EmbeddingModal({
  open,
  onClose,
  sessionId,
  questions,
}: EmbeddingModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={{ content: 'h-2/3' }}
      hideCloseButton
      onPrimaryAction={
        <Button onClick={onClose}>{t('shared.generic.close')}</Button>
      }
    >
      <H2 className={{ root: 'mb-4' }}>
        {t('manage.sessions.evaluationLinksEmbedding')}
      </H2>
      <div className="flex flex-col gap-2">
        {questions?.map((question: QuestionInstance, ix: number) => {
          return (
            <div key={question.id} className="flex flex-row items-center gap-2">
              <div className="w-20 font-bold">Frage {ix + 1}:</div>
              <div className="flex flex-row items-center gap-3 px-1.5 py-0.5 mr-2 border border-solid rounded bg-uzh-grey-40">
                <FontAwesomeIcon
                  icon={faClipboard}
                  className="hover:cursor-pointer"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${process.env.NEXT_PUBLIC_MANAGE_URL}/sessions/${sessionId}/evaluation?questionIx=${ix}`
                    )
                  }
                />
                <div className="text-sm">{`${process.env.NEXT_PUBLIC_MANAGE_URL}/sessions/${sessionId}/evaluation?questionIx=${ix}`}</div>
              </div>
              <p>
                {question.questionData.name.length > 25
                  ? `${question.questionData.name.substring(0, 25)}...`
                  : question.questionData.name}
              </p>
            </div>
          )
        })}
        <div className="flex flex-row items-center gap-2">
          <div className="font-bold w-30">
            {t('shared.generic.leaderboard')}:
          </div>
          <div className="flex flex-row items-center gap-3 px-1.5 py-0.5 mr-2 border border-solid rounded bg-uzh-grey-40">
            <FontAwesomeIcon
              icon={faClipboard}
              className="hover:cursor-pointer"
              onClick={() =>
                navigator.clipboard.writeText(
                  `${process.env.NEXT_PUBLIC_MANAGE_URL}/sessions/${sessionId}/evaluation?leaderboard=true`
                )
              }
            />
            <div className="text-sm">{`${process.env.NEXT_PUBLIC_MANAGE_URL}/sessions/${sessionId}/evaluation?leaderboard=true`}</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default EmbeddingModal
