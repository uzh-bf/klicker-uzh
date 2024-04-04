import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface DeletionModalProps {
  title: string
  description: string
  elementName: string
  message: string
  deleteElement: () => Promise<any>
  open: boolean
  setOpen: (value: boolean) => void
  primaryData: {
    cy: string
    test?: string
  }
  secondaryData: {
    cy: string
    test?: string
  }
}

function DeletionModal({
  title,
  description,
  elementName,
  message,
  deleteElement,
  open,
  setOpen,
  primaryData,
  secondaryData,
}: DeletionModalProps) {
  const t = useTranslations()

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteElement()
            setOpen(false)
          }}
          className={{
            root: twMerge('bg-red-600 font-bold text-white'),
          }}
          data={primaryData}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setOpen(false)} data={secondaryData}>
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      title={title}
      className={{
        content: 'w-[40rem] min-h-max h-max self-center pt-0',
        title: 'text-xl',
      }}
    >
      <div>
        <div>{description}</div>
        <H3
          className={{
            root: 'p-2 mt-1 border border-solid rounded border-uzh-grey-40',
          }}
        >
          {elementName}
        </H3>
        <div className="mt-4 text-sm italic">{message}</div>
      </div>
    </Modal>
  )
}

export default DeletionModal
