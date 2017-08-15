// @flow

import React from 'react'
import { reduxForm } from 'redux-form'
import { FormattedMessage } from 'react-intl'

import { withData, pageWithIntl } from '../../lib'

import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'

class Registration extends React.Component {
  props: {
    intl: $IntlShape,
    handleSubmit: () => mixed,
  }

  state: {}

  constructor(props) {
    super(props)
    this.state = {}
  }

  handleSubmit = (values: any) => {
    console.dir(values)
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
  reduxForm({
    form: 'registration',
  })(pageWithIntl(Registration)),
)
