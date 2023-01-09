import { Toast } from '@uzh-bf/design-system'

interface SessionStartToastProps {
  open: boolean
  setOpen: (open: boolean) => void
}

function SessionStartToast({ open, setOpen }: SessionStartToastProps) {
  return (
    <Toast openExternal={open} setOpenExternal={setOpen} type="error">
      Leider konnte Ihre Session aufgrund eines Fehlers nicht gestartet werden.
      Bitte versuchen Sie es später erneut.
    </Toast>
  )
}

export default SessionStartToast
