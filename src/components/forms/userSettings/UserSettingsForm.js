import React from 'react'
import { FormattedMessage, defineMessages, intlShape } from 'react-intl'
import { Message, Button, Tab } from 'semantic-ui-react'
import { Mutation } from 'react-apollo'

import AccountDataForm from './AccountDataForm'
import PasswordUpdateForm from './PasswordUpdateForm'
import { RequestAccountDeletionMutation } from '../../../graphql'

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
      render: () => (
        <Tab.Pane>
          <PasswordUpdateForm intl={intl} />
        </Tab.Pane>
      ),
    },
    {
      menuItem: intl.formatMessage(messages.deleteAccountItem),
      render: () => (
        <Tab.Pane>
          <Mutation mutation={RequestAccountDeletionMutation}>
            {(requestAccountDeletion, { loading, data }) => {
              const success = !loading && data?.requestAccountDeletion === 'ACCOUNT_DELETION_EMAIL_SENT'

              return (
                <>
                  <Message warning>
                    <FormattedMessage
                      defaultMessage="All your data will be removed from the Klicker servers. We will not be able to recover any of your data, should you find that you would still have needed it."
                      id="form.userSettings.string.accountDeletionWarning"
                    />
                  </Message>
                  <Message info>
                    <FormattedMessage
                      defaultMessage="To request deletion of your Klicker account, please click the button below. You will be sent an email that will allow you to confirm your account deletion."
                      id="form.userSettings.string.accountDeletionInfo"
                    />
                  </Message>

                  {success ? (
                    <Message success>
                      <FormattedMessage
                        defaultMessage="We have sent you an email regarding your account deletion request. Please check your inbox in a few minutes."
                        id="form.userSettings.button.successfulRequest"
                      />
                    </Message>
                  ) : (
                    <Button color="red" disabled={success} loading={loading} onClick={() => requestAccountDeletion()}>
                      <FormattedMessage
                        defaultMessage="Yes, I want to delete my account!"
                        id="form.userSettings.button.requestAccountDeletion"
                      />
                    </Button>
                  )}
                </>
              )
            }}
          </Mutation>
        </Tab.Pane>
      ),
    },
  ]

  return (
    <div className="userSettingsForm">
      <Tab
        grid={{ paneWidth: 12, reversed: 'mobile', stackable: true, tabWidth: 4 }}
        menu={{ fluid: true, tabular: true, vertical: true }}
        menuPosition="right"
        panes={panes}
      />

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
