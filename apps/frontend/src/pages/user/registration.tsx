import React from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useMutation } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'

import { Errors } from '../../constants'
import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'
import RegistrationMutation from '../../graphql/mutations/RegistrationMutation.graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Registration',
    id: 'user.registration.pageTitle',
  },
})

function Registration(): React.ReactElement {
  const intl = useIntl()

  const [register, { data, error, loading }] = useMutation(RegistrationMutation)

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="p-4 md:w-[750px]">
        <h1 className="mt-0">
          <FormattedMessage defaultMessage="Registration" id="user.registration.title" />
        </h1>

        {((): React.ReactElement => {
          const newEmail = data && data.createUser.email

          if (newEmail) {
            return (
              <div className="font-bold text-green-700">
                <FormattedMessage
                  defaultMessage="Successfully registered as {newEmail}.{br} Please activate your new account using the link in the email we just sent you. You can then login at {link}."
                  id="user.registration.successNotification"
                  values={{
                    br: <br />,
                    link: <Link href="/user/login">/user/login</Link>,
                    newEmail,
                  }}
                />
              </div>
            )
          }

          return (
            <>
              <Message warning>
                <FormattedMessage
                  defaultMessage="You don't need an account to respond to polls; just visit the given /join page of your lecturer and respond anonymously. However, feel free to create an account if you would like to create polls yourself."
                  id="user.registration.studentAccountWarning"
                />
              </Message>

              <Message info>
                <p>
                  A new version of KlickerUZH (v3) has been released and is accessible through{' '}
                  <a href="www.klicker.uzh.ch">www.klicker.uzh.ch</a>. This version (v2) of KlickerUZH will be shut down
                  on 31.12.2023 and new registrations have been disabled. A data migration allows you to transfer all of
                  your content from v2 to v3. More information on KlickerUZH v3 can be found in our{' '}
                  <a href="https://community.klicker.uzh.ch/t/klickeruzh-v3-0-release-information/79">community post</a>
                  .
                </p>
              </Message>
            </>
          )
        })()}
      </div>
    </StaticLayout>
  )
}

export default Registration
