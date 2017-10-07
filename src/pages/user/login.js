import React from 'react'
import Router from 'next/router'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { intlShape, FormattedMessage } from 'react-intl'
import { graphql } from 'react-apollo'

import StaticLayout from '../../components/layouts/StaticLayout'
import LoginForm from '../../components/forms/LoginForm'
import { LoginMutation } from '../../queries/mutations'
import { withData, pageWithIntl } from '../../lib'

const propTypes = {
  intl: intlShape.isRequired,
  login: PropTypes.func.isRequired,
}

class Login extends React.Component {
  state = {
    error: null,
  }

  handleSubmit = (values) => {
    this.props
      .login(values.email, values.password)
      .then(() => {
        // redirect to question pool
        Router.push('/questions')
        // this.setState({ error: null, success: data.login.email })
      })
      .catch(({ message }) => {
        this.setState({ error: message })
      })
  }

  render() {
    const { intl } = this.props
    const { error } = this.state

    return (
      <StaticLayout
        pageTitle={intl.formatMessage({
          defaultMessage: 'Login',
          id: 'user.login.pageTitle',
        })}
      >
        <div className="login">
          <h1>
            <FormattedMessage id="user.login.title" defaultMessage="Login" />
          </h1>

          {/* TODO: improve message handling */}
          {error && <div className="errorMessage message">Login failed: {error}</div>}

          <LoginForm intl={intl} onSubmit={this.handleSubmit} />

          <style jsx>
            {`
              .login {
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
                .login {
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

Login.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(LoginMutation, {
    props: ({ mutate }) => ({
      login: (email, password) => mutate({ variables: { email, password } }),
    }),
  }),
)(Login)
