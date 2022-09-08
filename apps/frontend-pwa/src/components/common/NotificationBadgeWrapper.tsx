import React from 'react'
import { twMerge } from 'tailwind-merge'

interface NotificationBadgeWrapperProps {
  count?: number
  withoutCount?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  badgePosition?: string
  badgeStyle?: string
  className?: string
  children: React.ReactNode
}

const defaultProps = {
  count: undefined,
  withoutCount: undefined,
  size: 'md',
  badgePosition: '',
  badgeStyle: '',
  className: '',
}

function NotificationBadgeWrapper({
  count,
  withoutCount,
  size,
  badgePosition,
  badgeStyle,
  className,
  children,
}: NotificationBadgeWrapperProps) {
  const sizeStyles = {
    sm: 'h-4 w-4 text-xs',
    md: 'h-5 w-5 text-sm leading-[1.1rem]',
    lg: 'h-[1.6rem] w-[1.6rem] text-lg leading-6',
    xl: 'h-7 w-7 text-xl leading-7',
  }

  if (count || withoutCount) {
    return (
      <div className={twMerge('relative', className)}>
        <div className={twMerge('flex flex-1')}>{children}</div>
        <div
          className={twMerge(
            'absolute right-1 z-10 text-center text-white bg-red-600 rounded-full top-1',
            sizeStyles[size || 'md'],
            badgePosition,
            badgeStyle
          )}
        >
          {!count ? '' : count < 10 && count > 0 ? count : '9+'}
        </div>
      </div>
    )
  } else {
    return <div className={className}>{children}</div>
  }
}

NotificationBadgeWrapper.defaultProps = defaultProps
export default NotificationBadgeWrapper
