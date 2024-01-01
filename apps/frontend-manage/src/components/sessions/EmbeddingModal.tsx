import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSessionHmacDocument,
  QuestionInstance,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

function LazyHMACLink({
  sessionId,
  params,
}: {
  sessionId: string
  params: string
}) {
  const sessionHMAC = useQuery(GetSessionHmacDocument, {
    variables: {
      id: sessionId,
    },
  })

  if (sessionHMAC.loading || !sessionHMAC.data?.sessionHMAC) {
    return ''
  }

  const link = `${
    process.env.NEXT_PUBLIC_MANAGE_URL
  }/sessions/${sessionId}/evaluation?hmac=${sessionHMAC.data?.sessionHMAC}${
    params ? `&${params}` : ''
  }`

  return (
    <div className="flex flex-row items-center gap-3">
      <Link
        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
        href={link}
        target="_blank"
        legacyBehavior
        passHref
      >
        <a data-cy={`open-embedding-link-session-${sessionId}`}>{link}</a>
      </Link>
      <Button
        onClick={() => navigator?.clipboard?.writeText(link)}
        data={{ cy: `copy-embed-link-session-${sessionId}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faClipboard} />
        </Button.Icon>
      </Button>
    </div>
  )
}

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

  const [showSolution, setShowSolution] = useState(false)

  return (
    <Modal
      title={t('manage.sessions.evaluationLinksEmbedding')}
      open={open}
      onClose={onClose}
      className={{ content: 'h-2/3' }}
      hideCloseButton
      onPrimaryAction={
        <Button onClick={onClose} data={{ cy: 'close-embedding-modal' }}>
          {t('shared.generic.close')}
        </Button>
      }
    >
      <div className="mb-4">
        <Switch
          label={t('manage.evaluation.showSolution')}
          checked={showSolution}
          onCheckedChange={(val) => setShowSolution(val)}
        />
      </div>
      <div className="mb-4">
        <div className="font-bold w-30">{t('shared.generic.evaluation')}</div>
        <LazyHMACLink sessionId={sessionId} params={``} />
      </div>
      <div className="flex flex-col gap-2">
        {questions?.map((question: QuestionInstance, ix: number) => {
          return (
            <div key={question.id}>
              <div className="font-bold">
                {ix + 1}{' '}
                {question.questionData.name.length > 25
                  ? `${question.questionData.name.substring(0, 25)}...`
                  : question.questionData.name}
              </div>
              <LazyHMACLink
                sessionId={sessionId}
                params={`questionIx=${ix}&hideControls=true&showSolution=${showSolution}`}
              />
            </div>
          )
        })}
        <div>
          <div className="font-bold w-30">
            {t('shared.generic.leaderboard')}:
          </div>
          <LazyHMACLink
            sessionId={sessionId}
            params={`leaderboard=true&hideControls=true`}
          />
        </div>
      </div>
    </Modal>
  )
}

export default EmbeddingModal
