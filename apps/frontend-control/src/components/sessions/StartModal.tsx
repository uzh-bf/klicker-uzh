import { useMutation } from '@apollo/client'
import { StartLiveQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface StartModalProps {
  startId: string
  startName: string
  startModalOpen: boolean
  setStartModalOpen: (open: boolean) => void
  setErrorToast: (open: boolean) => void
}

function StartModal({
  startId,
  startName,
  startModalOpen,
  setStartModalOpen,
  setErrorToast,
}: StartModalProps) {
  const t = useTranslations()
  const router = useRouter()
  const [startLiveQuiz, { loading: startingSession }] = useMutation(
    StartLiveQuizDocument
  )

  return (
    <Modal
      open={startModalOpen}
      onClose={() => setStartModalOpen(false)}
      onPrimaryAction={
        <Button
          loading={startingSession}
          onClick={async () => {
            try {
              await startLiveQuiz({
                variables: { id: startId },
              })
              router.push(`/session/${startId}`)
            } catch (error) {
              setStartModalOpen(false)
              setErrorToast(true)
            }
          }}
          className={{
            root: 'bg-primary-80 text-white',
          }}
          data={{
            cy: 'confirm-start-session',
          }}
        >
          {t('shared.generic.start')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => setStartModalOpen(false)}
          data={{ cy: 'cancel-start-session-modal' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      className={{ content: 'mx-auto my-auto h-max w-max md:min-w-[30rem]' }}
      hideCloseButton
    >
      <H3>{t('control.course.startLiveQuiz')}</H3>
      <div className="border-uzh-grey-100 bg-uzh-grey-20 rounded border border-solid p-2">
        {t('control.course.confirmStartLiveQuiz')}
        <div className="font-bold">{startName}</div>
      </div>
      <div className="mt-4 text-sm italic">
        {t('control.course.explanationStartLiveQuiz')}
      </div>
    </Modal>
  )
}

export default StartModal
