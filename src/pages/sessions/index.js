import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'

import { pageWithIntl, withData, withLogging, withSortingAndFiltering } from '../../lib'
import { AccountSummaryQuery, RunningSessionQuery, StartSessionMutation } from '../../graphql'
import { TeacherLayout } from '../../components/layouts'
import { SessionList } from '../../components/sessions'

const propTypes = {
  filters: PropTypes.object.isRequired,
  handleCopySession: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  handleSort: PropTypes.func.isRequired,
  handleStartSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const Index = ({
  intl,
  handleCopySession,
  handleSearch,
  handleSort,
  handleStartSession,
  filters,
}) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      search: {
        handleSearch: _debounce(handleSearch, 200),
        handleSort,
        query: '',
        sortBy: '',
        sortOrder: '',
      },
      title: intl.formatMessage({
        defaultMessage: 'Session List',
        id: 'sessionList.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Session List',
      id: 'sessionList.pageTitle',
    })}
    sidebar={{ activeItem: 'sessionList' }}
  >
    <div className="sessionList">
      <SessionList
        filters={filters}
        handleCopySession={handleCopySession}
        handleStartSession={handleStartSession}
        intl={intl}
      />
    </div>

    <style jsx>{`
      @import 'src/theme';

      .sessionList {
        padding: 1rem 0.7rem;

        height: 100%;
      }

      @include desktop-tablet-only {
        .sessionList {
          margin: auto;
          padding: 2rem;

          max-width: $max-width;
        }
      }
    `}</style>
  </TeacherLayout>
)

Index.propTypes = propTypes

export default compose(
  withLogging(),
  withData,
  pageWithIntl,
  graphql(StartSessionMutation),
  withSortingAndFiltering,
  withHandlers({
    // handle copying an existing session
    handleCopySession: () => id => async () => {
      console.log(`copy session ${id}`)
    },

    // handle starting an already created session
    handleStartSession: ({ mutate }) => id => async () => {
      try {
        await mutate({
          refetchQueries: [{ query: RunningSessionQuery }, { query: AccountSummaryQuery }],
          variables: { id },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
)(Index)
