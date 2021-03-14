import React from 'react'
import { defineMessages, useIntl } from 'react-intl'
import UserSettingsForm from '../../components/forms/userSettings/UserSettingsForm'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { withApollo } from '../../lib/apollo'
import useLogging from '../../lib/hooks/useLogging'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'User Settings',
    id: 'userSettings.pageTitle',
  },
  title: {
    defaultMessage: 'User Settings',
    id: 'userSettings.title',
  },
})

function Settings(): React.ReactElement {
  useLogging({ slaask: true })

  const intl = useIntl()

  return (
    <TeacherLayout
      navbar={{ title: intl.formatMessage(messages.title) }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'sessionList' }}
    >
      <UserSettingsForm />
    </TeacherLayout>
  )
}

export default withApollo()(Settings)
