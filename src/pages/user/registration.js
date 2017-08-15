// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'
import { graphql } from 'react-apollo'

import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'
import { RegistrationMutation } from '../../queries/mutations'
import { withData, pageWithIntl } from '../../lib'

class Registration extends React.Component {
  props: {
    createUser: ({ variables: { email: string, password: string, shortname: string } }) => mixed,
    intl: $IntlShape,
    handleSubmit: () => mixed,
  }

  handleSubmit = (values) => {
    this.props.createUser({
      variables: {
        email: values.email,
        password: values.password,
        shortname: values.shortname,
      },
    })
  }

  render() {
    const { intl } = this.props

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

          <RegistrationForm onSubmit={this.handleSubmit} />

          <style jsx>{`
            .registration {
              padding: 1rem;
            }
            h1 {
              margin-top: 0;
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
  pageWithIntl(graphql(RegistrationMutation, { name: 'createUser' })(Registration)),
)
