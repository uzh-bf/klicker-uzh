import React from 'react'
import { compose } from 'recompose'
import { defineMessages, intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { pageWithIntl, withLogging } from '../../lib'
import UserSettingsForm from '../../components/forms/userSettings/UserSettingsForm'

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

const propTypes = {
  intl: intlShape.isRequired,
}

const Settings = ({ intl }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage(messages.title),
    }}
    pageTitle={intl.formatMessage(messages.pageTitle)}
    sidebar={{ activeItem: 'sessionList' }}
  >
    <UserSettingsForm intl={intl} />
  </TeacherLayout>
)

Settings.propTypes = propTypes

export default compose(
  withLogging({
    slaask: true,
  }),
  pageWithIntl
)(Settings)
