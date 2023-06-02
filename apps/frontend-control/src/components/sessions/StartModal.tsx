import { useMutation } from '@apollo/client'
import { StartSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Modal, ThemeContext } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const router = useRouter()
  const theme = useContext(ThemeContext)
  const [startSession] = useMutation(StartSessionDocument)

  return (
    <Modal
      open={startModalOpen}
      onClose={() => setStartModalOpen(false)}
      onPrimaryAction={
        <Button
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
            root: twMerge('text-white', theme.primaryBgDark),
          }}
          data={{
            cy: 'confirm-start-session',
          }}
        >
          Starten
        </Button>
      }
      onSecondaryAction={
        <Button onClick={() => setStartModalOpen(false)}>Abbrechen</Button>
      }
      className={{ content: 'h-max w-max md:min-w-[30rem] my-auto mx-auto' }}
      hideCloseButton
    >
      <H3>Session starten</H3>
      <div className="p-2 border border-solid rounded border-uzh-grey-100 bg-uzh-grey-20">
        Sind Sie sich sicher, dass sie die folgende Session starten möchten?
        <div className="font-bold">{startName}</div>
      </div>
      <div className="mt-4 text-sm italic">
        Bitte beachten Sie, dass eine gestartete Live-Session grundsätzlich
        öffentlich zugänglich ist. Laufende Sessionen können über die
        Management-App abgebrochen oder gestoppt werden.
      </div>
    </Modal>
  )
}

export default StartModal
