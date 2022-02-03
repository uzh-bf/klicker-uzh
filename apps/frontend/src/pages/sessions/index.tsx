import React from 'react'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import { useMutation } from '@apollo/client'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import { useToasts } from 'react-toast-notifications'

import useSortingAndFiltering from '../../lib/hooks/useSortingAndFiltering'
import AccountSummaryQuery from '../../graphql/queries/AccountSummaryQuery.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import StartSessionMutation from '../../graphql/mutations/StartSessionMutation.graphql'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import SessionList from '../../components/sessions/SessionList'

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
  const { addToast } = useToasts()

  const [startSession] = useMutation(StartSessionMutation)

  const { handleSearch, handleSort, filters } = useSortingAndFiltering()

  const onStartSession =
    (id: string): any =>
    async (): Promise<void> => {
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
      <div className="h-full py-4 px-[0.7rem] md:m-auto md:p-8 md:max-w-screen-xl">
        <SessionList filters={filters} handleCopySession={(f: any): any => f} handleStartSession={onStartSession} />
      </div>
    </TeacherLayout>
  )
}

export default Index
