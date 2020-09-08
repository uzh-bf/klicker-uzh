import React from 'react'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import { useMutation } from '@apollo/react-hooks'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import { useToasts } from 'react-toast-notifications'

import useSortingAndFiltering from '../../lib/hooks/useSortingAndFiltering'
import useLogging from '../../lib/hooks/useLogging'
import AccountSummaryQuery from '../../graphql/queries/AccountSummaryQuery.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import StartSessionMutation from '../../graphql/mutations/StartSessionMutation.graphql'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import SessionList from '../../components/sessions/SessionList'
import { withApollo } from '../../lib/apollo'

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
  useLogging({ slaask: true })

  const intl = useIntl()
  const router = useRouter()
  const { addToast } = useToasts()

  const [startSession] = useMutation(StartSessionMutation)

  const { handleSearch, handleSort, filters } = useSortingAndFiltering()

  const onStartSession = (id: string): any => async (): Promise<void> => {
    try {
      await startSession({
        refetchQueries: [{ query: SessionListQuery }, { query: RunningSessionQuery }, { query: AccountSummaryQuery }],
        variables: { id },
      })

      router.push('/sessions/running')
    } catch ({ message }) {
      console.error(message)
      addToast(
        <FormattedMessage
          defaultMessage="Unable to start session: {errorMessage}"
          id="sessions.index.startSession.error"
          values={{ errorMessage: message }}
        />,
        {
          appearance: 'error',
          autoDismiss: false,
        }
      )
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
        <SessionList filters={filters} handleCopySession={(f): any => f} handleStartSession={onStartSession} />
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

export default withApollo()(Index)
