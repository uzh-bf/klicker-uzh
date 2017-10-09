import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'

import StaticLayout from '../../components/layouts/StaticLayout'
import PasswordResetForm from '../../components/forms/PasswordResetForm'
import { pageWithIntl, withData } from '../../lib'

const propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const ResetPassword = ({ intl, handleSubmit }) => (
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

      <PasswordResetForm intl={intl} onSubmit={handleSubmit} />

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

ResetPassword.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  withState('error', 'setError', null),
  withState('success', 'setSuccess', null),
  withHandlers({
    // TODO: handle form submission
    handleSubmit: () => () => console.log('submit'),
  }),
)(ResetPassword)
