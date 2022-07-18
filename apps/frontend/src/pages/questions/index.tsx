import React, { useState, useEffect, useMemo } from 'react'
import { v4 as UUIDv4 } from 'uuid'
import _get from 'lodash/get'
import _debounce from 'lodash/debounce'
import _some from 'lodash/some'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import { useQuery, useMutation } from '@apollo/client'
import { Loader, Message } from 'semantic-ui-react'
import { useToasts } from 'react-toast-notifications'
import { push } from '@socialgouv/matomo-next'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import useSelection from '../../lib/hooks/useSelection'
import useSortingAndFiltering from '../../lib/hooks/useSortingAndFiltering'
import CreateSessionMutation from '../../graphql/mutations/CreateSessionMutation.graphql'
import StartSessionMutation from '../../graphql/mutations/StartSessionMutation.graphql'
import AccountSummaryQuery from '../../graphql/queries/AccountSummaryQuery.graphql'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import QuestionPoolQuery from '../../graphql/queries/QuestionPoolQuery.graphql'
import ArchiveQuestionsMutation from '../../graphql/mutations/ArchiveQuestionsMutation.graphql'
import ModifySessionMutation from '../../graphql/mutations/ModifySessionMutation.graphql'
import DeleteQuestionsMutation from '../../graphql/mutations/DeleteQuestionsMutation.graphql'
import SessionEditForm from '../../components/forms/sessionCreation/SessionEditForm'
import SessionCreationForm from '../../components/forms/sessionCreation/SessionCreationForm'
import QuestionList from '../../components/questions/QuestionList'
import TagList from '../../components/questions/TagList'
import ActionSearchArea from '../../components/questions/ActionSearchArea'
import { QUESTION_SORTINGS } from '../../constants'
import { processItems, buildIndex } from '../../lib/utils/filters'
import { AuthenticationMode } from '../../components/forms/sessionCreation/SessionParticipantSettings'
import useStickyState from '../../lib/hooks/useStickyState'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Question Pool',
    id: 'questionPool.pageTitle',
  },
  title: {
    defaultMessage: 'Question Pool',
    id: 'questionPool.title',
  },
})

function Index(): React.ReactElement {
  const intl = useIntl()
  const router = useRouter()
  const { addToast } = useToasts()

  useEffect((): void => {
    router.prefetch('/sessions/running')
    router.prefetch('/sessions')
  })

  const [isSurveyBannerVisible, setIsSurveyBannerVisible, hasSurveyBannerInitialized] = useStickyState(
    true,
    'gamification-survey-visible'
  )

  const [deletionConfirmation, setDeletionConfirmation] = useState(false)
  const [sessionBlocks, setSessionBlocks] = useState((): any => [])
  const [sessionName, setSessionName] = useState('')

  const [isAuthenticationEnabled, setIsAuthenticationEnabled] = useState(false)
  const [sessionParticipants, setSessionParticipants] = useState([])
  const [sessionAuthenticationMode, setSessionAuthenticationMode] = useState('NONE' as AuthenticationMode)

  const [startSession, { loading: isStartSessionLoading }] = useMutation(StartSessionMutation)
  const [createSession, { loading: isCreateSessionLoading }] = useMutation(CreateSessionMutation)
  const [archiveQuestions, { loading: isArchiveQuestionsLoading }] = useMutation(ArchiveQuestionsMutation)
  const [modifySession, { loading: isModifySessionLoading }] = useMutation(ModifySessionMutation)
  const [deleteQuestions, { loading: isDeleteQuestionsLoading }] = useMutation(DeleteQuestionsMutation)
  const { data, loading } = useQuery(QuestionPoolQuery)

  const [selectedItems, handleSelectItem, handleResetSelection, handleSelectItems] = useSelection()
  const {
    filters,
    sort,
    handleSearch,
    handleSortByChange,
    handleSortOrderToggle,
    handleTagClick,
    handleReset,
    handleToggleArchive,
  } = useSortingAndFiltering()

  const runningSessionId = _get(data, 'runningSessionId')

  const index = useMemo(() => {
    if (data?.questions) {
      return buildIndex('questions', data.questions, ['title', 'createdAt'])
    }
    return null
  }, [data])

  const [processedQuestions, setProcessedQuestions] = useState([])
  useEffect((): any => {
    if (!data || !data.questions) {
      return
    }

    // process questions according to filters and sort settings
    setProcessedQuestions(processItems(data.questions, filters, sort, index))
  }, [data, filters, sort, index])

  const { editSessionId, copy: copyMode } = router.query

  // override the toggle archive function
  // need to reset the selection on toggling archive to not apply actions to hidden questions
  const onToggleArchive = (): void => {
    handleResetSelection()
    handleToggleArchive()
    push(['trackEvent', 'Question Pool', 'Archive Toggled'])
  }

  // handle archiving a question
  const onArchiveQuestions = async (): Promise<void> => {
    if (isArchiveQuestionsLoading) {
      return
    }
    try {
      // archive the questions
      await archiveQuestions({
        variables: { ids: selectedItems.ids },
      })

      push(['trackEvent', 'Question Pool', 'Questions Archived', selectedItems.ids.length])

      addToast(
        <FormattedMessage
          defaultMessage="Questions successfully archived/unarchived."
          id="questions.index.archivation.toast.successful"
        />,
        { appearance: 'success' }
      )

      handleResetSelection()
    } catch ({ message }) {
      console.error(message)
      addToast(
        <FormattedMessage
          defaultMessage="Unable to archive question: {errorMessage}"
          id="questions.index.archivation.toast.error"
          values={{ errorMessage: message }}
        />,
        {
          appearance: 'error',
          autoDismiss: false,
        }
      )
    }
  }

  // build a single block from all the checked questions
  const onQuickBlock = (submitSelection: boolean): void => {
    if (!submitSelection) {
      setSessionBlocks([
        ...sessionBlocks,
        {
          id: UUIDv4(),
          questions: selectedItems.items.map(({ id, title, type, version }): any => ({
            id,
            key: UUIDv4(),
            title,
            type,
            version,
          })),
        },
      ])
    } else {
      // reset question selection on submit
      handleResetSelection()
    }

    push(['trackEvent', 'Question Pool', 'Quick Block Created', selectedItems.items.length])
  }

  // build a separate block for each checked question
  const onQuickBlocks = (submitSelection: boolean): void => {
    if (!submitSelection) {
      setSessionBlocks([
        ...sessionBlocks,
        ...selectedItems.items.map(({ id, title, type, version }): any => ({
          id: UUIDv4(),
          questions: [
            {
              id,
              key: UUIDv4(),
              title,
              type,
              version,
            },
          ],
        })),
      ])
    } else {
      // reset question selection on submit
      handleResetSelection()
    }

    push(['trackEvent', 'Question Pool', 'Quick Blocks Created', selectedItems.items.length])
  }

  const handleQuickStart = async (): Promise<void> => {
    setSessionBlocks([
      ...sessionBlocks,
      ...selectedItems.items.map(({ id, title, type, version }): any => ({
        id: UUIDv4(),
        questions: [
          {
            id,
            key: UUIDv4(),
            title,
            type,
            version,
          },
        ],
      })),
    ])

    const blocks = selectedItems.items.map((question: any): any => {
      return {
        questions: [
          {
            question: question.id,
            version: question.version || 0,
          },
        ],
      }
    })
    handleResetSelection()
    setSessionBlocks([])

    const result = await createSession({
      refetchQueries: [{ query: SessionListQuery }],
      variables: {
        blocks,
        name: sessionName,
        participants: sessionParticipants.map((username) => ({ username })),
        authenticationMode: sessionAuthenticationMode,
      },
    })
    await startSession({
      refetchQueries: [{ query: SessionListQuery }, { query: RunningSessionQuery }, { query: AccountSummaryQuery }],
      variables: { id: result.data.createSession?.id || result.data.modifySession?.id },
    })

    push(['trackEvent', 'Question Pool', 'Quick Start Session'])
    router.push('/sessions/running')
  }

  // handle creating a new session
  const onCreateSession =
    (type): any =>
    async (e): Promise<void> => {
      // prevent a page reload on submit
      e.preventDefault()
      if (_some([isCreateSessionLoading, isModifySessionLoading, isStartSessionLoading])) {
        return
      }

      try {
        // prepare blocks for consumption through the api
        const blocks = sessionBlocks.map(({ questions }): any => ({
          questions: questions.map(({ id, version = 0 }): any => ({
            question: id,
            version,
          })),
        }))

        let result
        if (editSessionId && !copyMode) {
          // modify an existing session
          result = await modifySession({
            refetchQueries: [{ query: SessionListQuery }],
            variables: {
              blocks,
              id: editSessionId,
              name: sessionName,
              participants: sessionParticipants.map((username) => ({ username })),
              authenticationMode: sessionAuthenticationMode,
            },
          })

          push(['trackEvent', 'Question Pool', 'Session Modified'])
        } else {
          // create a new session
          result = await createSession({
            refetchQueries: [{ query: SessionListQuery }],
            variables: {
              blocks,
              name: sessionName,
              participants: sessionParticipants.map((username) => ({ username })),
              authenticationMode: sessionAuthenticationMode,
            },
          })

          push(['trackEvent', 'Question Pool', 'Session Created'])
        }

        // start the session immediately if the respective button was clicked
        if (type === 'start') {
          await startSession({
            refetchQueries: [
              { query: SessionListQuery },
              { query: RunningSessionQuery },
              { query: AccountSummaryQuery },
            ],
            variables: { id: result.data.createSession?.id || result.data.modifySession?.id },
          })
          push(['trackEvent', 'Question Pool', 'Session Started'])
          router.push('/sessions/running')
        } else {
          const ToastContent = (
            <FormattedMessage
              defaultMessage="Session successfully created. Visit the {link} to manage your new
            session."
              id="questions.index.createSession.success"
              values={{
                link: <Link href="/sessions">Session List</Link>,
              }}
            />
          )
          addToast(ToastContent, {
            appearance: 'success',
          })
        }

        setSessionBlocks([])
        setIsAuthenticationEnabled(false)
        setSessionParticipants([])
        setSessionAuthenticationMode('PASSWORD')
        setSessionName('')
      } catch ({ message }) {
        console.error(message)
        addToast(
          <FormattedMessage
            defaultMessage="Unable to create session: {errorMessage}"
            id="questions.index.createSession.error"
            values={{ errorMessage: message }}
          />,
          {
            appearance: 'error',
            autoDismiss: false,
          }
        )
      }
    }

  // handle deleting questions
  const onDeleteQuestions = async (confirm): Promise<any> => {
    if (!deletionConfirmation) {
      setDeletionConfirmation(true)
      return
    }

    if (isDeleteQuestionsLoading) {
      return
    }

    if (confirm) {
      try {
        const questionIds = Array.from(selectedItems.ids)
        await deleteQuestions({
          optimisticResponse: {
            __typename: 'Mutation',
            deleteQuestions: 'DELETION_SUCCESSFUL',
          },
          update: (cache, { data: updatedData }): void => {
            if (updatedData.deleteQuestions !== 'DELETION_SUCCESSFUL') {
              return
            }

            // @ts-ignore
            const { questions } = cache.readQuery({ query: QuestionPoolQuery })
            cache.writeQuery({
              data: {
                questions: questions.filter((question): boolean => !questionIds.includes(question.id)),
              },
              query: QuestionPoolQuery,
            })

            setDeletionConfirmation(false)
          },
          variables: { ids: questionIds },
        })

        push(['trackEvent', 'Question Pool', 'Questions Deleted', questionIds.length])

        handleResetSelection()

        addToast(
          <FormattedMessage
            defaultMessage="Questions successfully deleted."
            id="questions.index.deleteQuestion.success"
          />,
          {
            appearance: 'success',
          }
        )
      } catch ({ message }) {
        console.error(message)
        addToast(
          <FormattedMessage
            defaultMessage="Unable to delete questions: {errorMessage}"
            id="questions.index.deleteQuestion.error"
            values={{ errorMessage: message }}
          />,
          {
            appearance: 'error',
            autoDismiss: false,
          }
        )
      }
    }

    setDeletionConfirmation(false)
  }

  return (
    <TeacherLayout
      fixedHeight
      navbar={{
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'questionPool' }}
    >
      <div className="w-full h-full overflow-y-scroll">
        <div className="flex justify-center mx-10 md:h-72 print-hidden md:mx-20">
          <div className="max-w-[100rem] h-full w-full mt-6 gap-5">
            {editSessionId ? (
              <SessionEditForm
                handleCreateSession={onCreateSession}
                handleSetIsAuthenticationEnabled={setIsAuthenticationEnabled}
                handleSetSessionAuthenticationMode={setSessionAuthenticationMode}
                handleSetSessionBlocks={setSessionBlocks}
                handleSetSessionName={setSessionName}
                handleSetSessionParticipants={setSessionParticipants}
                isAuthenticationEnabled={isAuthenticationEnabled}
                runningSessionId={runningSessionId}
                sessionAuthenticationMode={sessionAuthenticationMode}
                sessionBlocks={sessionBlocks}
                sessionName={sessionName}
                sessionParticipants={sessionParticipants}
                setSessionName={setSessionName}
              />
            ) : (
              <SessionCreationForm
                handleCreateSession={onCreateSession}
                handleSetIsAuthenticationEnabled={setIsAuthenticationEnabled}
                handleSetSessionAuthenticationMode={setSessionAuthenticationMode}
                handleSetSessionBlocks={setSessionBlocks}
                handleSetSessionName={setSessionName}
                handleSetSessionParticipants={setSessionParticipants}
                isAuthenticationEnabled={isAuthenticationEnabled}
                runningSessionId={runningSessionId}
                sessionAuthenticationMode={sessionAuthenticationMode}
                sessionBlocks={sessionBlocks}
                sessionName={sessionName}
                sessionParticipants={sessionParticipants}
                setSessionName={setSessionName}
              />
            )}
          </div>
        </div>
        <div className="flex h-max justify-center md:min-h-[27.5rem] md:h-[calc(100vh-23.75rem)] mx-auto">
          <div className="flex flex-col md:flex-row max-w-[100rem] h-full w-full mt-6 gap-5 mx-10 md:mx-20">
            <TagList
              activeTags={filters.tags}
              activeType={filters.type}
              handleReset={handleReset}
              handleTagClick={handleTagClick}
              handleToggleArchive={onToggleArchive}
              isArchiveActive={filters.archive}
            />

            <div className="w-full">
              {!data || loading ? (
                <Loader active />
              ) : (
                <div className="flex flex-col w-full">
                  <ActionSearchArea
                    withSorting
                    deletionConfirmation={deletionConfirmation}
                    handleArchiveQuestions={onArchiveQuestions}
                    handleDeleteQuestions={onDeleteQuestions}
                    handleQuickBlock={onQuickBlock}
                    handleQuickBlocks={onQuickBlocks}
                    handleQuickStart={handleQuickStart}
                    handleResetItemsChecked={handleResetSelection}
                    handleSearch={_debounce(handleSearch, 200)}
                    handleSetItemsChecked={handleSelectItems}
                    handleSortByChange={handleSortByChange}
                    handleSortOrderToggle={handleSortOrderToggle}
                    isArchiveActive={filters.archive}
                    itemsChecked={selectedItems.ids}
                    key="action-area"
                    questions={processedQuestions}
                    sessionBlocks={sessionBlocks}
                    setSessionBlocks={setSessionBlocks}
                    sortBy={sort.by}
                    sortOrder={sort.asc}
                    sortingTypes={QUESTION_SORTINGS}
                  />

                  <div
                    className="w-full mt-4 md:min-h-[20rem] h-full md:h-[calc(100vh-30.5rem)] md:overflow-y-auto  md:mx-auto"
                    key="question-list"
                  >
                    <QuestionList
                      questions={processedQuestions}
                      selectedItems={selectedItems}
                      onQuestionChecked={handleSelectItem}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {hasSurveyBannerInitialized && (isSurveyBannerVisible ?? true) && (
          <div className="fixed bottom-0 left-0 right-0 sm:right-[10%] sm:left-[10%]">
            <Message
              warning
              className="!rounded-none"
              content={
                <FormattedMessage
                  defaultMessage="We would like to invite you to participate in our newest survey on Gamification and Game-Based Learning (see {link}, duration ca. 10min). Based on your feedback, we will also implement functionalities in the KlickerUZH."
                  id="questionPool.survey"
                  values={{
                    link: (
                      <a href="https://ref.bf-app.ch/gamification-klicker" rel="noreferrer" target="_blank">
                        link
                      </a>
                    ),
                  }}
                />
              }
              icon="bullhorn"
              onDismiss={() => setIsSurveyBannerVisible(false)}
            />
          </div>
        )}
      </div>
    </TeacherLayout>
  )
}

export default Index
