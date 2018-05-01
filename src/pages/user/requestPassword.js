import React from 'react'
import { compose } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'

import { StaticLayout } from '../../components/layouts'
import { PasswordRequestForm } from '../../components/forms'
import { pageWithIntl, withData, withLogging } from '../../lib'
import { RequestPasswordMutation } from '../../graphql'

const propTypes = {
  intl: intlShape.isRequired,
}

const RequestPassword = ({ intl }) => (
  <StaticLayout
    pageTitle={intl.formatMessage({
      defaultMessage: 'Reset password',
      id: 'user.resetPassword.pageTitle',
    })}
  >
    <div className="resetPassword">
      <h1>
        <FormattedMessage defaultMessage="Reset your password" id="user.requestPassword.title" />
      </h1>

      <Mutation mutation={RequestPasswordMutation}>
        {(requestPassword, { data, error, loading }) => {
          const success = data && !error

          if (success) {
            return (
              <Message success>
                <FormattedMessage
                  defaultMessage="An email has been sent to the provided address. Please follow the instructions therein to regain access to your account."
                  id="user.requestPassword.success"
                />
              </Message>
            )
          }

          return (
            <React.Fragment>
              <PasswordRequestForm
                intl={intl}
                loading={loading}
                onSubmit={({ email }) => {
                  requestPassword({ variables: { email } })
                }}
              />
              {error && <Message error>{error.message}</Message>}
            </React.Fragment>
          )
        }}
      </Mutation>

      <style jsx>{`
        @import 'src/theme';

        .resetPassword {
          padding: 1rem;

          h1 {
            margin-top: 0;
          }

          @include desktop-tablet-only {
            margin: 0 15%;
            width: 500px;
          }
        }
      `}</style>
    </div>
  </StaticLayout>
)

RequestPassword.propTypes = propTypes

export default compose(withLogging(), withData, pageWithIntl)(RequestPassword)
