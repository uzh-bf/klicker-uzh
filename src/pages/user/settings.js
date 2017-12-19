import React from 'react'
import { compose } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { pageWithIntl, withData } from '../../lib'

const propTypes = {
  intl: intlShape.isRequired,
}

const Settings = ({ intl }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage({
        defaultMessage: 'Question Pool',
        id: 'teacher.questionPool.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Settings',
      id: 'user.settings.pageTitle',
    })}
    sidebar={{ activeItem: null }}
  >
    <div className="userSettings">
      <h1>
        <FormattedMessage defaultMessage="Settings" id="user.settings.title" />
      </h1>
    </div>
  </TeacherLayout>
)

Settings.propTypes = propTypes

export default compose(withData, pageWithIntl)(Settings)
