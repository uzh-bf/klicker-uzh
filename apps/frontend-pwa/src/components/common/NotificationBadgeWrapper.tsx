import React from 'react'
import { twMerge } from 'tailwind-merge'

interface NotificationBadgeWrapperProps {
  count?: number
  withoutCount?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  children: React.ReactNode
}

const defaultProps = {} // TODO

function NotificationBadgeWrapper({
  count,
  withoutCount,
  size,
  className,
  children,
}: NotificationBadgeWrapperProps) {
  const sizeStyles = {
    sm: 'h-4 w-4 text-xs',
    md: 'h-[1.2rem] w-[1.2rem] text-sm',
    lg: 'h-[1.6rem] w-[1.6rem] text-lg',
    xl: 'h-7 w-7 text-xl pt-[0.1rem]',
  }
  console.log(count)
  if (!count && withoutCount) {
    return (
      <div className={twMerge('relative', className)}>
        <div className={twMerge('flex flex-1')}>{children}</div>
        <div
          className={twMerge(
            'absolute right-1 z-10 text-center text-white bg-red-600 rounded-full top-1',
            sizeStyles[size || 'md']
          )}
        />
      </div>
    )
  } else if (count) {
    return (
      <div className={twMerge('relative', className)}>
        <div className={twMerge('flex flex-1')}>{children}</div>
        <div
          className={twMerge(
            'absolute right-1 z-10 text-center text-white bg-red-600 rounded-full top-1',
            sizeStyles[size || 'md']
          )}
        >
          {count < 10 && count > 0 ? count : '9+'}
        </div>
      </div>
    )
  } else {
    return <div className={className}>{children}</div>
  }
}

export default NotificationBadgeWrapper
