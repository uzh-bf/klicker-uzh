import React from 'react'
import { compose } from 'recompose'
import { defineMessages, useIntl } from 'react-intl'
import { useMutation } from 'react-apollo'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'

import { withLogging } from '../../lib'
import useSortingAndFiltering from '../../lib/useSortingAndFiltering'
import { AccountSummaryQuery, RunningSessionQuery, StartSessionMutation, SessionListQuery } from '../../graphql'
import { TeacherLayout } from '../../components/layouts'
import { SessionList } from '../../components/sessions'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Session List',
    id: 'sessionList.pageTitle',
  },
  title: {
    defaultMessage: 'Session List',
    id: 'sessionList.title',
  },
})

function Index(): React.ReactElement {
  const intl = useIntl()
  const router = useRouter()

  const [startSession, _] = useMutation(StartSessionMutation)

  const { handleSearch, handleSort, filters } = useSortingAndFiltering()

  const onStartSession = id => async () => {
    try {
      await startSession({
        refetchQueries: [{ query: SessionListQuery }, { query: RunningSessionQuery }, { query: AccountSummaryQuery }],
        variables: { id },
      })

      router.push('/sessions/running')
    } catch ({ message }) {
      console.error(message)
    }
  }

  return (
    <TeacherLayout
      navbar={{
        search: {
          handleSearch: _debounce(handleSearch, 200),
          handleSort,
          query: '',
          sortBy: '',
          sortOrder: '',
        },
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'sessionList' }}
    >
      <div className="sessionList">
        <SessionList filters={filters} handleCopySession={f => f} handleStartSession={onStartSession} />
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
}

export default compose(
  withLogging({
    slaask: true,
  })
)(Index)
