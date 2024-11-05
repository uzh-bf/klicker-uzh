import { useMutation } from '@apollo/client'
import { StartSessionDocument } from '@klicker-uzh/graphql/dist/ops'
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
  const [startSession, { loading: startingSession }] =
    useMutation(StartSessionDocument)

  return (
    <Modal
      open={startModalOpen}
      onClose={() => setStartModalOpen(false)}
      onPrimaryAction={
        <Button
          loading={startingSession}
          onClick={async () => {
            try {
              await startSession({
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
      <H3>{t('control.course.startSession')}</H3>
      <div className="border-uzh-grey-100 bg-uzh-grey-20 rounded border border-solid p-2">
        {t('control.course.confirmStartSession')}
        <div className="font-bold">{startName}</div>
      </div>
      <div className="mt-4 text-sm italic">
        {t('control.course.explanationStartSession')}
      </div>
    </Modal>
  )
}

export default StartModal
