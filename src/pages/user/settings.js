import React from 'react'
import { compose } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { pageWithIntl } from '../../lib'

const propTypes = {
  intl: intlShape.isRequired,
}

const Settings = ({ intl }) => (
  <TeacherLayout
    pageTitle={intl.formatMessage({
      defaultMessage: 'Reset password',
      id: 'user.resetPassword.pageTitle',
    })}
  >
    <div className="userSettings">
      <h1>
        <FormattedMessage defaultMessage="Settings" id="user.settings.title" />
      </h1>
    </div>
  </TeacherLayout>
)

Settings.propTypes = propTypes

export default compose(pageWithIntl)(Settings)
