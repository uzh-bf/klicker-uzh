import { H4, Toast } from '@uzh-bf/design-system'

interface FlagSuccessToastProps {
  open: boolean
  setOpen: (newValue: boolean) => void
}

function FlagSuccessToast({ open, setOpen }: FlagSuccessToastProps) {
  return (
    <Toast
      duration={5000}
      type="success"
      openExternal={open}
      setOpenExternal={setOpen}
    >
      <H4>Thank you!</H4>
      <div>Feedback sent successfully.</div>
    </Toast>
  )
}

export default FlagSuccessToast
