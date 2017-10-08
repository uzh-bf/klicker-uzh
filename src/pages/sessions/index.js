import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'

import { pageWithIntl, withData } from '../../lib'
import { RunningSessionQuery, StartSessionMutation } from '../../queries'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import SessionList from '../../components/sessions/SessionList'

const propTypes = {
  intl: intlShape.isRequired,
  startSession: PropTypes.func.isRequired,
}

class Index extends React.Component {
  // handle searching in the navbar search area
  handleSearch = (query) => {
    console.log(`Searched... for ${query}`)
  }

  // handle sorting via navbar search area
  handleSort = (by, order) => {
    console.log(`sorted by ${by} in ${order} order`)
  }

  handleCopySession = id => async () => {
    console.log(`copy session ${id}`)
  }

  handleStartSession = id => async () => {
    try {
      const result = await this.props.startSession({ id })
      console.dir(result)
    } catch ({ message }) {
      console.error(message)
    }
  }

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      search: {
        handleSearch: this.handleSearch,
        handleSort: this.handleSort,
        query: '',
        sortBy: '',
        sortOrder: '',
      },
      title: intl.formatMessage({
        defaultMessage: 'Session History',
        id: 'teacher.sessionHistory.title',
      }),
    }

    return (
      <TeacherLayout
        intl={intl}
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Session History',
          id: 'teacher.sessionHistory.pageTitle',
        })}
        sidebar={{ activeItem: 'sessionHistory' }}
      >
        <div className="sessionHistory">
          <SessionList
            intl={intl}
            handleCopySession={this.handleCopySession}
            handleStartSession={this.handleStartSession}
          />
        </div>

        <style jsx>
          {`
            .sessionHistory {
              padding: 1rem 0.7rem;
            }

            @media all and (min-width: 768px) {
              .sessionHistory {
                padding: 2rem;
              }
            }

            @media all and (min-width: 991px) {
              .sessionHistory {
                padding: 2rem 10%;
              }
            }
          `}
        </style>
      </TeacherLayout>
    )
  }
}

Index.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(StartSessionMutation, {
    props: ({ mutate }) => ({
      startSession: ({ id }) =>
        mutate({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { id },
        }),
    }),
  }),
)(Index)
