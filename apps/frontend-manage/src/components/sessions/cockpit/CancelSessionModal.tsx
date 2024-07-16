import { useMutation } from '@apollo/client'
import {
  CancelSessionDocument,
  GetUserRunningSessionsDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface CancelSessionModalProps {
  sessionId: string
  title: string
  isCancellationModalOpen: boolean
  setIsCancellationModalOpen: (value: boolean) => void
}

function CancelSessionModal({
  sessionId,
  title,
  isCancellationModalOpen,
  setIsCancellationModalOpen,
}: CancelSessionModalProps) {
  const router = useRouter()
  const t = useTranslations()
  const [enteredName, setEnteredName] = useState('')

  const [cancelSession] = useMutation(CancelSessionDocument, {
    variables: { id: sessionId },
    refetchQueries: [
      {
        query: GetUserRunningSessionsDocument,
      },
      {
        query: GetUserSessionsDocument,
      },
    ],
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await cancelSession()
            router.push('/sessions')
          }}
          className={{
            root: twMerge(
              'bg-red-600 font-bold text-white',
              enteredName !== title && 'opacity-60 cursor-not-allowed'
            ),
          }}
          data={{ cy: 'confirm-cancel-session' }}
          disabled={enteredName !== title}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setIsCancellationModalOpen(false)}
          data={{ cy: 'abort-cancel-session' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setIsCancellationModalOpen(false)}
      open={isCancellationModalOpen}
      hideCloseButton={true}
      className={{ content: 'w-[48rem] min-h-max h-max self-center !pt-0' }}
    >
      <div>
        <H2>{t('manage.cockpit.confirmAbortSession', { title: title })}</H2>
        <div className="my-2 italic">
          {t('manage.cockpit.abortSessionHint')}
        </div>
        <div>
          <div className="font-bold">{t('manage.cockpit.abortEnterName')}</div>
          <TextField
            value={enteredName}
            onChange={(newValue) => setEnteredName(newValue)}
            className={{ input: '!w-80' }}
            data={{ cy: 'abort-enter-name' }}
          />
        </div>
      </div>
    </Modal>
  )
}

export default CancelSessionModal
