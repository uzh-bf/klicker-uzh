import React from 'react'
import { defineMessages, intlShape } from 'react-intl'
import { Tab } from 'semantic-ui-react'

import AccountDataForm from './AccountDataForm'

const messages = defineMessages({
  accountDataItem: {
    defaultMessage: 'Account Data',
    id: 'form.userSettings.accountDataItem',
  },
  changePasswordItem: {
    defaultMessage: 'Change Password',
    id: 'form.userSettings.changePasswordItem',
  },
  deleteAccountItem: {
    defaultMessage: 'Delete Account',
    id: 'form.userSettings.deleteAccountItem',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
}

const UserSettingsForm = ({ intl }) => {
  const panes = [
    {
      menuItem: intl.formatMessage(messages.accountDataItem),
      render: () => (
        <Tab.Pane>
          <AccountDataForm intl={intl} />
        </Tab.Pane>
      ),
    },
    {
      menuItem: intl.formatMessage(messages.changePasswordItem),
      render: () => <Tab.Pane>Tab 2 Content</Tab.Pane>,
    },
    {
      menuItem: intl.formatMessage(messages.deleteAccountItem),
      render: () => <Tab.Pane>Tab 2 Content</Tab.Pane>,
    },
  ]

  return (
    <div className="userSettingsForm">
      <Tab menu={{ fluid: true, tabular: true, vertical: true }} menuPosition="right" panes={panes} />

      <style jsx>{`
        @import 'src/theme';

        .userSettingsForm {
          padding: 1rem;

          @include desktop-only {
            margin: 0 20%;
            padding: 1rem 0;
          }
        }
      `}</style>
    </div>
  )
}

UserSettingsForm.propTypes = propTypes

export default UserSettingsForm
