import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

interface OfflineNotificationProps {
  LayoutComponent: React.ComponentType<{
    title: string
    children: React.ReactNode
  }>
}

const OfflineNotification = ({ LayoutComponent }: OfflineNotificationProps) => {
  const t = useTranslations()

  return (
    <LayoutComponent title="KlickerUZH">
      <div className="flex items-center justify-center align-middle">
        <UserNotification
          type="info"
          message={t('shared.error.offlineHint')}
        ></UserNotification>
      </div>
    </LayoutComponent>
  )
}

export const fallback = ({ LayoutComponent }: OfflineNotificationProps) => {
  return () => <OfflineNotification LayoutComponent={LayoutComponent} />
}
