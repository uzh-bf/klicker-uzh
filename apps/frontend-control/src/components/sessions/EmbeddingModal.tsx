import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSessionHmacDocument,
  GetSingleLiveSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'

interface EmbeddingModalProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  sessionId: string
}

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
    <div className="flex flex-row items-center gap-3 px-1.5 py-0.5 mr-2 border border-solid rounded bg-uzh-grey-40">
      <FontAwesomeIcon
        icon={faClipboard}
        className="hover:cursor-pointer"
        onClick={() => navigator?.clipboard?.writeText(link)}
      />
      <Link href={link} target="_blank" legacyBehavior passHref>
        <a data-cy={`open-embedding-link-session-${sessionId}`}>{link}</a>
      </Link>
    </div>
  )
}

function EmbeddingModal({ open, setOpen, sessionId }: EmbeddingModalProps) {
  const t = useTranslations()
  const { data: dataLiveSession } = useQuery(GetSingleLiveSessionDocument, {
    variables: { sessionId: sessionId || '' },
    skip: !sessionId,
  })

  const questions = useMemo(
    () =>
      dataLiveSession?.liveSession?.blocks?.flatMap(
        (block) => block.instances
      ) || [],
    [dataLiveSession?.liveSession?.blocks]
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
          'h-max max-h-[calc(100%-5rem)] overflow-y-scroll w-full md:w-max md:min-w-[30rem] my-auto mx-auto',
      }}
      hideCloseButton
    >
      <H2>{t('control.course.pptEmbedding')}</H2>
      <div className="flex flex-col gap-3">
        {questions?.map((question: any, ix: number) => {
          return (
            <div key={question.id}>
              <div className="w-full font-bold line-clamp-1">{`${ix + 1}. ${
                question.questionData.name
              }`}</div>
              <div className="flex flex-row items-center gap-3 px-1.5 py-0.5 mr-2 border border-solid rounded bg-uzh-grey-40">
                <LazyHMACLink
                  sessionId={sessionId}
                  params={`questionIx=${ix}`}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3">
        <div className="font-bold w-30">{t('shared.generic.leaderboard')}:</div>
        <LazyHMACLink sessionId={sessionId} params={`leaderboard=true`} />
      </div>
    </Modal>
  )
}

export default EmbeddingModal
