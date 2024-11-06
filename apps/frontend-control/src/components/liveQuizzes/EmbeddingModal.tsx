import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetLiveQuizHmacDocument,
  GetSingleLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'

interface EmbeddingModalProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  quizId: string
}

function LazyHMACLink({ quizId, params }: { quizId: string; params: string }) {
  const quizHMAC = useQuery(GetLiveQuizHmacDocument, {
    variables: {
      id: quizId,
    },
  })

  if (quizHMAC.loading || !quizHMAC.data?.liveQuizHMAC) {
    return <></>
  }

  const link = `${
    process.env.NEXT_PUBLIC_MANAGE_URL
  }/sessions/${quizId}/evaluation?hmac=${quizHMAC.data?.liveQuizHMAC}${
    params ? `&${params}` : ''
  }`

  return (
    <div className="bg-uzh-grey-40 mr-2 flex flex-row items-center gap-3 rounded border border-solid px-1.5 py-0.5">
      <FontAwesomeIcon
        icon={faClipboard}
        className="hover:cursor-pointer"
        onClick={() => navigator?.clipboard?.writeText(link)}
      />
      <Link href={link} target="_blank" legacyBehavior passHref>
        <a data-cy={`open-embedding-link-quiz-${quizId}`}>{link}</a>
      </Link>
    </div>
  )
}

function EmbeddingModal({ open, setOpen, quizId }: EmbeddingModalProps) {
  const t = useTranslations()
  const { data: dataLiveQuiz } = useQuery(GetSingleLiveQuizDocument, {
    variables: { quizId: quizId || '' },
    skip: !quizId,
  })

  const questions = useMemo(
    () =>
      dataLiveQuiz?.liveQuiz?.blocks?.flatMap((block) => block.elements) || [],
    [dataLiveQuiz?.liveQuiz?.blocks]
  )

  return (
    <Modal
      asPortal
      open={open}
      onOpenChange={() => setOpen(!open)}
      onClose={() => setOpen(false)}
      onPrimaryAction={
        <Button
          onClick={() => setOpen(false)}
          data={{ cy: 'close-embedding-modal' }}
        >
          {t('shared.generic.close')}
        </Button>
      }
      className={{
        content:
          'mx-auto my-auto h-max max-h-[calc(100%-5rem)] w-full overflow-y-scroll md:w-max md:min-w-[30rem]',
      }}
      hideCloseButton
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
              <div className="bg-uzh-grey-40 mr-2 flex flex-row items-center gap-3 rounded border border-solid px-1.5 py-0.5">
                <LazyHMACLink quizId={quizId} params={`questionIx=${ix}`} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3">
        <div className="w-30 font-bold">{t('shared.generic.leaderboard')}:</div>
        <LazyHMACLink quizId={quizId} params={`leaderboard=true`} />
      </div>
    </Modal>
  )
}

export default EmbeddingModal
