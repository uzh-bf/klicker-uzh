import React from 'react'
import _get from 'lodash/get'
import { FormattedMessage, defineMessages, useIntl } from 'react-intl'
import { Message, Button, Tab } from 'semantic-ui-react'
import { useMutation } from '@apollo/client'

import AccountDataForm from './AccountDataForm'
import PasswordUpdateForm from './PasswordUpdateForm'
import RequestAccountDeletionMutation from '../../../graphql/mutations/RequestAccountDeletionMutation.graphql'

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

function UserSettingsForm(): React.ReactElement {
  const intl = useIntl()

  const [requestAccountDeletion, { loading, data }] = useMutation(RequestAccountDeletionMutation)

  const panes = [
    {
      menuItem: intl.formatMessage(messages.accountDataItem),
      render: (): React.ReactElement => (
        <Tab.Pane>
          <AccountDataForm />
        </Tab.Pane>
      ),
    },
    {
      menuItem: intl.formatMessage(messages.changePasswordItem),
      render: (): React.ReactElement => (
        <Tab.Pane>
          <PasswordUpdateForm />
        </Tab.Pane>
      ),
    },
    {
      menuItem: intl.formatMessage(messages.deleteAccountItem),
      render: (): React.ReactElement => {
        const success = !loading && _get(data, 'requestAccountDeletion') === 'ACCOUNT_DELETION_EMAIL_SENT'
        return (
          <Tab.Pane>
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
              <Button
                color="red"
                disabled={success}
                loading={loading}
                onClick={(): void => {
                  requestAccountDeletion()
                }}
              >
                <FormattedMessage
                  defaultMessage="Yes, I want to delete my account!"
                  id="form.userSettings.button.requestAccountDeletion"
                />
              </Button>
            )}
          </Tab.Pane>
        )
      },
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

export default UserSettingsForm
