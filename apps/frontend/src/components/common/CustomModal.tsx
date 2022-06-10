import React from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import CustomButton from './CustomButton'

interface Props {
  trigger?: React.ReactNode
  title?: string | React.ReactNode
  open: boolean
  children: React.ReactNode
  submitLabel?: string
  onSubmit?: () => void
  discardLabel?: string
  onDiscard?: () => void
  onOpenChange?: () => void
  className: string
}

const defaultProps = {
  title: '',
  trigger: undefined,
}

export function Modal({
  trigger,
  title,
  children,
  onDiscard,
  onSubmit,
  open,
  onOpenChange,
  discardLabel,
  submitLabel,
  className,
}: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed top-0 bottom-0 left-0 right-0 grid items-center justify-center bg-gray-500 bg-opacity-50">
          <RadixDialog.Content
            className={clsx(
              'flex flex-col max-w-7xl xl:w-[80rem] lg:w-[60rem] md:w-[50rem] sm:w-[40rem] w-[30rem] h-[90%] overflow-y-scroll gap-4 p-6 bg-white border shadow rounded-xl',
              className
            )}
          >
            {title && <RadixDialog.Title className="pb-2 text-xl font-bold border-b">{title}</RadixDialog.Title>}

            <div>{children}</div>

            <div className="flex flex-row justify-between">
              <div>
                {onDiscard && (
                  <RadixDialog.Close asChild>
                    <CustomButton onClick={onDiscard}>{discardLabel ?? 'Discard'}</CustomButton>
                  </RadixDialog.Close>
                )}
              </div>
              <div>
                {onSubmit && (
                  <RadixDialog.Close asChild>
                    <CustomButton onClick={onSubmit}>{submitLabel ?? 'Submit'}</CustomButton>
                  </RadixDialog.Close>
                )}
              </div>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

Modal.defaultProps = defaultProps
export default Modal
