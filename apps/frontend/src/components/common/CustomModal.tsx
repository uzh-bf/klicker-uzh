import * as RadixDialog from '@radix-ui/react-dialog'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
  trigger?: React.ReactNode
  title?: string | React.ReactNode
  open: boolean
  children: React.ReactNode
  submitLabel?: string
  submitEnabled?: boolean
  escapeEnabled?: boolean
  onSubmit?: () => void
  submitStyle?: string
  discardLabel?: string
  discardStyle?: string
  discardEnabled?: boolean
  onDiscard?: () => void
  onOpenChange?: () => void
  errorMessages?: string[]
  className?: string
}

const defaultProps = {
  title: '',
  trigger: undefined,
  className: '',
  submitLabel: undefined,
  submitEnabled: false,
  escapeEnabled: false,
  onSubmit: undefined,
  discardLabel: undefined,
  onDiscard: undefined,
  discardEnabled: true,
  onOpenChange: undefined,
  submitStyle: '',
  discardStyle: '',
  errorMessages: [],
}

export function Modal({
  trigger,
  title,
  children,
  onDiscard,
  onSubmit,
  submitStyle,
  submitEnabled,
  escapeEnabled,
  open,
  onOpenChange,
  discardLabel,
  discardStyle,
  discardEnabled,
  submitLabel,
  className,
  errorMessages,
}: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed top-0 bottom-0 left-0 right-0 grid items-center justify-center bg-gray-500 bg-opacity-50">
          <RadixDialog.Content
            className={twMerge(
              'flex flex-col max-w-7xl xl:w-[80rem] lg:w-[60rem] md:w-[50rem] sm:w-[40rem] w-[30rem] max-h-[90%] overflow-y-scroll gap-4 p-6 bg-white border shadow rounded-xl',
              className
            )}
            onEscapeKeyDown={escapeEnabled ? onDiscard : null}
          >
            {title && <RadixDialog.Title className="pb-2 text-xl font-bold border-b">{title}</RadixDialog.Title>}

            <div>{children}</div>

            <div
              className={twMerge(
                'grid gap-2 md:gap-4 gird-cols-1 mt-12 md:mt-0 md:grid-cols-3',
                errorMessages?.length === 0 && 'md:!grid-cols-2 !mt-12'
              )}
            >
              <div className="relative">
                {onDiscard && (
                  <RadixDialog.Close asChild className="absolute bottom-0 left-0 mt-max">
                    <Button
                      className={twMerge('py-2 text-base font-bold px-7 w-full md:w-max', discardStyle)}
                      disabled={!discardEnabled}
                      onClick={onDiscard}
                    >
                      <Button.Label>{discardLabel ?? 'Close'}</Button.Label>
                    </Button>
                  </RadixDialog.Close>
                )}
              </div>
              <div
                className={twMerge(
                  'gap-2 p-1 text-center bg-red-100 border border-red-300 border-solid rounded-md md:w-full',
                  errorMessages?.length === 0 && 'hidden'
                )}
              >
                {errorMessages.map((error) => (
                  <div className="text-red-800" key={error}>
                    {error}
                  </div>
                ))}
              </div>
              <div className="relative">
                {onSubmit && (
                  <RadixDialog.Close asChild className="absolute bottom-0 right-0">
                    <Button
                      className={twMerge('py-2 text-base font-bold px-7 w-full md:w-max', submitStyle)}
                      disabled={!submitEnabled}
                      onClick={onSubmit}
                    >
                      <Button.Label>{submitLabel ?? 'Submit'}</Button.Label>
                    </Button>
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
