import * as RadixToast from '@radix-ui/react-toast'
import { Button } from '@uzh-bf/design-system'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ToastProps {
  title?: string
  description?: string
  duration?: number
  triggerText?: string
  actionText?: string
  actionOnClick?: () => void
  position?: string
  openExternal?: boolean
  setOpenExternal?: (open: boolean) => void
  children?: React.ReactNode
  className?: {
    root?: string
    viewport?: string
    trigger?: string
    title?: string
    description?: string
    children?: string
    action?: string
  }
}

interface ToastPropsWithTitle extends ToastProps {
  title: string
  description?: string
  children?: never
}

interface ToastPropsWithChildren extends ToastProps {
  title?: never
  description?: never
  children: React.ReactNode
}

interface ToastPropsWithTitleTrigger extends ToastPropsWithTitle {
  triggerText: string
  openExternal?: never
  setOpenExternal?: never
}
interface ToastPropsWithTitleNoTrigger extends ToastPropsWithTitle {
  triggerText?: never
  openExternal: boolean
  setOpenExternal: (open: boolean) => void
}
interface ToastPropsWithChildrenTrigger extends ToastPropsWithChildren {
  triggerText: string
  openExternal?: never
  setOpenExternal?: never
}
interface ToastPropsWithChildrenNoTrigger extends ToastPropsWithChildren {
  triggerText?: never
  openExternal: boolean
  setOpenExternal: (open: boolean) => void
}

const defaultProps = {
  title: undefined,
  description: undefined,
  duration: 4000,
  actionText: undefined,
  actionOnClick: undefined,
  position: 'topRight',
  children: undefined,
  className: undefined,
}

function Toast({
  title,
  description,
  duration,
  triggerText,
  actionText,
  actionOnClick,
  position,
  openExternal,
  setOpenExternal,
  children,
  className,
}:
  | ToastPropsWithTitleTrigger
  | ToastPropsWithTitleNoTrigger
  | ToastPropsWithChildrenTrigger
  | ToastPropsWithChildrenNoTrigger): React.ReactElement {
  const [open, setOpen] = useState(false)
  const eventDateRef = useRef(new Date())
  const timerRef = useRef(0)

  const positionDict: Record<string, string> = {
    topRight: 'top-0 right-0',
    topLeft: 'top-0 left-0',
    bottomRight: 'bottom-0 right-0',
    bottomLeft: 'bottom-0 left-0',
  }

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <RadixToast.Provider swipeDirection="right">
      {!openExternal && !setOpenExternal && (
        <Button
          onClick={() => {
            setOpen(false)
            window.clearTimeout(timerRef.current)
            timerRef.current = window.setTimeout(() => {
              eventDateRef.current = new Date('2020-01-01T00:00:00')
              setOpen(true)
            }, 100)
          }}
          className={{ root: className?.trigger }}
        >
          {triggerText}
        </Button>
      )}

      <RadixToast.Root
        className={twMerge(
          'grid items-center p-4 bg-white rounded-md shadow-md border-md gap-x-4',
          className?.root
        )}
        open={openExternal || open}
        onOpenChange={setOpenExternal || setOpen}
        duration={duration || 4000}
      >
        {!children && (
          <>
            <RadixToast.Title
              className={twMerge('mb-2 font-bold', className?.title)}
            >
              {title}
            </RadixToast.Title>
            <RadixToast.Description
              asChild
              className={twMerge('m-0', className?.description)}
            >
              {description}
            </RadixToast.Description>
          </>
        )}
        <div className={className?.children}>{children}</div>
        {actionText && actionOnClick && (
          <RadixToast.Action asChild altText="Goto schedule to undo">
            <Button
              onClick={actionOnClick}
              className={{ root: className?.action }}
            >
              {actionText}
            </Button>
          </RadixToast.Action>
        )}
      </RadixToast.Root>
      <RadixToast.Viewport
        className={twMerge(
          'fixed top-0 right-0 flex flex-col p-3 gap-2 max-w-3xl min-w-[20rem] m-0 list-none z-[1000] outline-none',
          positionDict[position || 'topRight'],
          className?.viewport
        )}
      />
    </RadixToast.Provider>
  )
}

Toast.defaultProps = defaultProps
export default Toast
