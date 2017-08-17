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
    loginUser: ({ variables: { email: string, password: string } }) => mixed,
    intl: $IntlShape,
    handleSubmit: () => mixed,
  }

  handleSubmit = (values) => {
    this.props.loginUser({
      variables: {
        email: values.email,
        password: values.password,
      },
    })
  }

  render() {
    const { intl } = this.props

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

          <LoginForm intl={intl} onSubmit={this.handleSubmit} />

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

export default withData(pageWithIntl(graphql(LoginMutation, { name: 'loginUser' })(Login)))
