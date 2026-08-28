import { H1, UserNotification } from '@uzh-bf/design-system'
import React from 'react'
import Layout from '../Layout'

function AnalyticsUnavailableView({
  title,
  navigation,
  message,
  type = 'info',
}: {
  title: string
  navigation?: React.ReactNode
  message: string
  type?: 'info' | 'error'
}) {
  return (
    <Layout displayName={title}>
      {navigation}
      <H1>{title}</H1>
      <UserNotification
        message={message}
        type={type}
        className={{ root: 'mx-auto my-auto w-max max-w-full text-base' }}
      />
    </Layout>
  )
}

export default AnalyticsUnavailableView
