// @flow

import * as React from 'react'
import { FormattedMessage } from 'react-intl'

import StaticLayout from '../../components/layouts/StaticLayout'
import PasswordResetForm from '../../components/forms/PasswordResetForm'
import { withData, pageWithIntl } from '../../lib'

type Props = {
  intl: any,
  handleSubmit: () => mixed,
}
class ResetPassword extends React.Component<Props> {
  handleSubmit = () => {
    console.log('reset password...')
  }

  render() {
    const { intl } = this.props

    return (
      <StaticLayout
        pageTitle={intl.formatMessage({
          defaultMessage: 'Reset password',
          id: 'user.resetPassword.pageTitle',
        })}
      >
        <div className="login">
          <h1>
            <FormattedMessage id="user.resetPassword.title" defaultMessage="Reset password" />
          </h1>

          <PasswordResetForm intl={intl} onSubmit={this.handleSubmit} />

          <style jsx>{`
            .login {
              padding: 1rem;
            }
            h1 {
              margin-top: 0;
            }

            @media all and (min-width: 991px) {
              .login {
                margin: 0 15%;
              }
            }
          `}</style>
        </div>
      </StaticLayout>
    )
  }
}

export default withData(pageWithIntl(ResetPassword))
