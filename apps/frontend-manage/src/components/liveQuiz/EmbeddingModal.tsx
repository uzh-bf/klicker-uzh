import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstance,
  GetLiveQuizHmacDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

function LazyHMACLink({ quizId, params }: { quizId: string; params: string }) {
  const sessionHMAC = useQuery(GetLiveQuizHmacDocument, {
    variables: {
      id: quizId,
    },
  })

  if (sessionHMAC.loading || !sessionHMAC.data?.liveQuizHMAC) {
    return <></>
  }

  const link = `${
    process.env.NEXT_PUBLIC_MANAGE_URL
  }/sessions/${quizId}/evaluation?hmac=${sessionHMAC.data?.liveQuizHMAC}${
    params ? `&${params}` : ''
  }`

  return (
    <div className="flex max-w-full flex-row items-center justify-between gap-3">
      <Link
        className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
        href={link}
        target="_blank"
        legacyBehavior
        passHref
      >
        <a
          data-cy={`open-embedding-link-session-${quizId}`}
          className="max-w-[calc(100%-3.5rem)] break-words text-sm"
        >
          {link}
        </a>
      </Link>
      <Button
        onClick={() => navigator?.clipboard?.writeText(link)}
        data={{ cy: `copy-embed-link-session-${quizId}` }}
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
  quizId: string
  elements?: (Pick<ElementInstance, 'id'> & { elementData: { name: string } })[]
}

function EmbeddingModal({
  open,
  onClose,
  quizId,
  elements,
}: EmbeddingModalProps) {
  const t = useTranslations()

  const [showSolution, setShowSolution] = useState(false)

  return (
    <Modal
      title={t('manage.liveQuizzes.evaluationLinksEmbedding')}
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
        <div className="w-30 font-bold">{t('shared.generic.evaluation')}</div>
        <LazyHMACLink quizId={quizId} params={``} />
      </div>
      <div className="flex flex-col gap-2">
        {elements?.map((element, ix) => {
          return (
            <div key={element.id}>
              <div className="font-bold">
                {ix + 1}{' '}
                {element.elementData.name.length > 25
                  ? `${element.elementData.name.substring(0, 25)}...`
                  : element.elementData.name}
              </div>
              <LazyHMACLink
                quizId={quizId}
                params={`questionIx=${ix}&hideControls=true&showSolution=${showSolution}`}
              />
            </div>
          )
        })}
        <div>
          <div className="w-30 font-bold">
            {t('shared.generic.leaderboard')}:
          </div>
          <LazyHMACLink
            quizId={quizId}
            params={`leaderboard=true&hideControls=true`}
          />
        </div>
      </div>
    </Modal>
  )
}

export default EmbeddingModal
