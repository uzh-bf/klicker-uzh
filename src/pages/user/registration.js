import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { intlShape, FormattedMessage } from 'react-intl'
import { graphql } from 'react-apollo'

import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'
import { RegistrationMutation } from '../../queries/mutations'
import { withData, pageWithIntl } from '../../lib'

const propTypes = {
  createUser: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

class Registration extends React.Component {
  state = {
    error: null,
    success: null,
  }

  handleSubmit = (values) => {
    this.props
      .createUser(values.email, values.password, values.shortname)
      .then(({ data }) => {
        this.setState({ error: null, success: data.createUser.email })
      })
      .catch(({ message }) => {
        this.setState({ error: message, success: null })
      })
  }

  render() {
    const { intl } = this.props
    const { error, success } = this.state

    return (
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

          <RegistrationForm intl={intl} onSubmit={this.handleSubmit} />

          <style jsx>
            {`
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
            `}
          </style>
        </div>
      </StaticLayout>
    )
  }
}

Registration.propTypes = propTypes

const withRegistrationMutation = graphql(RegistrationMutation, {
  props: ({ mutate }) => ({
    createUser: (email, password, shortname) =>
      mutate({ variables: { email, password, shortname } }),
  }),
})
export default compose(withData, pageWithIntl, withRegistrationMutation)(Registration)
