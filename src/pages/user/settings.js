import React from 'react'
import { FormattedMessage, intlShape } from 'react-intl'
import { compose } from 'recompose'

import { TeacherLayout } from '../../components/layouts'
import { GeneralSettingsForm, PasswordSettingsForm } from '../../components/forms'
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
        <FormattedMessage defaultMessage="Account Settings" id="user.settings.title" />
      </h1>

      <div className="settingsForm">
        <GeneralSettingsForm className="settingsForm" intl={intl} />
      </div>

      <div className="settingsForm">
        <PasswordSettingsForm className="settingsForm" intl={intl} />
      </div>

      <style jsx>{`
        .userSettings {
          display: flex;
          flex-direction: column;
          height: 100%;
          margin: 2rem 10rem;

          .settingsForm {
            margin-bottom: 2rem;
          }
        }
      `}</style>
    </div>
  </TeacherLayout>
)

Settings.propTypes = propTypes

export default compose(withData, pageWithIntl)(Settings)
