import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'

import { pageWithIntl, withData } from '../../lib'
import { RunningSessionQuery, StartSessionMutation } from '../../queries'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import SessionList from '../../components/sessions/SessionList'

const propTypes = {
  handleCopySession: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  handleSort: PropTypes.func.isRequired,
  handleStartSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const Index = ({
  intl, handleCopySession, handleSearch, handleSort, handleStartSession,
}) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      search: {
        handleSearch,
        handleSort,
        query: '',
        sortBy: '',
        sortOrder: '',
      },
      title: intl.formatMessage({
        defaultMessage: 'Session History',
        id: 'teacher.sessionHistory.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Session History',
      id: 'teacher.sessionHistory.pageTitle',
    })}
    sidebar={{ activeItem: 'sessionHistory' }}
  >
    <div className="sessionHistory">
      <SessionList
        intl={intl}
        handleCopySession={handleCopySession}
        handleStartSession={handleStartSession}
      />
    </div>

    <style jsx>{`
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
    `}</style>
  </TeacherLayout>
)

Index.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(StartSessionMutation),
  withHandlers({
    // handle copying an existing session
    handleCopySession: () => id => async () => {
      console.log(`copy session ${id}`)
    },

    // handle updating the search bar
    handleSearch: () => (query) => {
      console.log(`Searched... for ${query}`)
    },

    // handle modifying sort settings
    handleSort: () => (by, order) => {
      console.log(`sorted by ${by} in ${order} order`)
    },

    // handle starting an already created session
    handleStartSession: ({ mutate }) => async (id) => {
      try {
        await mutate({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { id },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
)(Index)
