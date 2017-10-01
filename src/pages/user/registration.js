// @flow

import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { graphql } from 'react-apollo'

import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'
import { RegistrationMutation } from '../../queries/mutations'
import { withData, pageWithIntl } from '../../lib'

type Props = {
  intl: any,
  createUser: (email: string, password: string, shortname: string) => Promise<*>,
}
type State = {
  error: string,
  success: string,
}
class Registration extends React.Component<Props, State> {
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
  }
}

export default withData(
  pageWithIntl(
    graphql(RegistrationMutation, {
      props: ({ mutate }) => ({
        createUser: (email, password, shortname) =>
          mutate({ variables: { email, password, shortname } }),
      }),
    })(Registration),
  ),
)
