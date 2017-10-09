import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { FormattedMessage, intlShape, withState, withHandlers } from 'react-intl'
import { graphql } from 'react-apollo'

import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'
import { RegistrationMutation } from '../../queries/mutations'
import { pageWithIntl, withData } from '../../lib'

const propTypes = {
  error: PropTypes.oneOfType(PropTypes.string, null).isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  success: PropTypes.oneOfType(PropTypes.string, null).isRequired,
}

const Registration = ({
  intl, error, success, handleSubmit,
}) => (
  <StaticLayout
    pageTitle={intl.formatMessage({
      defaultMessage: 'Registration',
      id: 'user.registration.pageTitle',
    })}
  >
    <div className="registration">
      <h1>
        <FormattedMessage id="user.registration.title" defaultMessage="Registration" />
      </h1>

      {/* TODO: improve message handling */}
      {error && <div className="errorMessage message">Registration failed: {error}</div>}
      {success && (
        <div className="successMessage message">Successfully registered as {success}</div>
      )}

      <RegistrationForm intl={intl} onSubmit={handleSubmit} />

      <style jsx>{`
        .registration {
          padding: 1rem;
        }
        h1 {
          margin-top: 0;
        }

        .message {
          font-weight: bold;
        }
        .errorMessage {
          color: red;
        }
        .successMessage {
          color: green;
        }

        @media all and (min-width: 991px) {
          .registration {
            margin: 0 15%;
          }
        }
      `}</style>
    </div>
  </StaticLayout>
)

Registration.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(RegistrationMutation),
  withState('error', 'setError', null),
  withState('success', 'setSuccess', null),
  withHandlers({
    // handle form submission
    handleSubmit: ({ mutate, setError, setSuccess }) => async ({ email, password, shortname }) => {
      try {
        const result = await mutate({ variables: { email, password, shortname } })
        setSuccess(result.data.createUser.email)
      } catch ({ message }) {
        console.error(message)
        setError(message)
      }
    },
  }),
)(Registration)
