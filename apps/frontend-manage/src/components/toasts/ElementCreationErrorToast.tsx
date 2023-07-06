import { Toast } from '@uzh-bf/design-system'

interface ElementCreationErrorToastProps {
  error: string
  open: boolean
  setOpen: (open: boolean) => void
}

function ElementCreationErrorToast({
  error,
  open,
  setOpen,
}: ElementCreationErrorToastProps): React.ReactElement {
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

export default ElementCreationErrorToast
