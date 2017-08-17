// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

import TeacherLayout from '../../../components/layouts/TeacherLayout'
import { withData, pageWithIntl } from '../../../lib'

class Settings extends React.Component {
  props: {
    intl: $IntlShape,
    handleSubmit: () => mixed,
  }

  handleSubmit = (values) => {
    console.dir(values)
  }

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Settings',
        id: 'user.settings.title',
      }),
    }

    return (
      <TeacherLayout
        intl={intl}
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Settings',
          id: 'user.settings.pageTitle',
        })}
        sidebar={{ activeItem: 'account' }}
      >
        <div className="settings">
          hello

          <style jsx>{`
            .settings {
              padding: 1rem;
            }

            @media all and (min-width: 991px) {
              .settings {
                margin: 0 15%;
              }
            }
          `}</style>
        </div>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Settings))
