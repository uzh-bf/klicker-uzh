import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'

import { StaticLayout } from '../../components/layouts'
import { PasswordResetForm } from '../../components/forms'
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
    <div className="resetPassword">
      <h1>
        <FormattedMessage defaultMessage="Reset password" id="user.resetPassword.title" />
      </h1>

      <PasswordResetForm intl={intl} onSubmit={handleSubmit} />

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
