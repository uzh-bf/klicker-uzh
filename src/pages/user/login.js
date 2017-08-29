// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'
import { graphql } from 'react-apollo'

import StaticLayout from '../../components/layouts/StaticLayout'
import LoginForm from '../../components/forms/LoginForm'
import { LoginMutation } from '../../queries/mutations'
import { withData, pageWithIntl } from '../../lib'

class Login extends React.Component {
  props: {
    intl: $IntlShape,
    login: (email: string, password: string) => Promise<*>,
  }

  state = {
    error: null,
    success: null,
  }

  handleSubmit = (values) => {
    this.props
      .login(values.email, values.password)
      .then(({ data }) => {
        // TODO: redirect to question pool
        this.setState({ error: null, success: data.login.email })
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
          {success && <div className="successMessage message">Successfully logged in as {success}</div>}

          <LoginForm error={this.state.error} intl={intl} onSubmit={this.handleSubmit} />

          <style jsx>{`
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
          `}</style>
        </div>
      </StaticLayout>
    )
  }
}

export default withData(
  pageWithIntl(
    graphql(LoginMutation, {
      props: ({ mutate }) => ({
        login: (email, password) => mutate({ variables: { email, password } }),
      }),
    })(Login),
  ),
)
