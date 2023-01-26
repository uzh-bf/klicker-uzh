import { Toast } from '@uzh-bf/design-system'

interface SessionCreationErrorToastProps {
  error: string
  open: boolean
  setOpen: (open: boolean) => void
}

function SessionCreationErrorToast({
  error,
  open,
  setOpen,
}: SessionCreationErrorToastProps): React.ReactElement {
  return (
    <Toast
      duration={6000}
      openExternal={open}
      setOpenExternal={setOpen}
      type="error"
    >
      <div>
        <div>{error}</div>
        <div>Bitte beachten Sie die Fehlermeldungen im Formular</div>
      </div>
    </Toast>
  )
}

export default SessionCreationErrorToast
