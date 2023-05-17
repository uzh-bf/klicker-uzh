import { UserNotification } from '@uzh-bf/design-system'
import React from 'react'

interface OfflineNotificationProps {
  LayoutComponent: React.ComponentType<{
    title: string
    children: React.ReactNode
  }>
}

const OfflineNotification = ({ LayoutComponent }: OfflineNotificationProps) => {
  return (
    <LayoutComponent title="KlickerUZH">
      <div className="flex items-center justify-center align-middle">
        <UserNotification
          type="info"
          message="Sie scheinen im Moment offline zu sein. Verbinden Sie Ihr Gerät mit dem Internet, um die KlickerUZH App nutzen zu können."
        ></UserNotification>
      </div>
    </LayoutComponent>
  )
}

export const fallback = ({ LayoutComponent }: OfflineNotificationProps) => {
  return <OfflineNotification LayoutComponent={LayoutComponent} />
}
