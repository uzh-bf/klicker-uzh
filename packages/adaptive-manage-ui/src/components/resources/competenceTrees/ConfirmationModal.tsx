import { Button, Modal } from '@uzh-bf/design-system'

function ConfirmationModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
  dataCy,
}: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
  dataCy: string
}) {
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      data={{ cy: dataCy }}
      className={{ content: 'max-w-xl' }}
    >
      <p className="mb-5 text-sm text-slate-700">{message}</p>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} data={{ cy: `${dataCy}-cancel` }}>
          <Button.Label>{cancelLabel}</Button.Label>
        </Button>
        <Button
          primary={!destructive}
          destructive={destructive}
          onClick={onConfirm}
          data={{ cy: `${dataCy}-confirm` }}
        >
          <Button.Label>{confirmLabel}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default ConfirmationModal
