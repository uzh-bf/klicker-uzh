import React, { useState, useEffect } from 'react'
import UUIDv4 from 'uuid'
import _get from 'lodash/get'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import dayjs from 'dayjs'
import { defineMessages, useIntl } from 'react-intl'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { Loader } from 'semantic-ui-react'
import { useToasts } from 'react-toast-notifications'

import useLogging from '../../lib/hooks/useLogging'
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
import ActionBar from '../../components/questions/ActionBar'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { QUESTION_SORTINGS } from '../../constants'
import { processItems, buildIndex } from '../../lib/utils/filters'

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
  useLogging({ slaask: true })

  const intl = useIntl()
  const router = useRouter()
  const { addToast } = useToasts()

  useEffect((): void => {
    router.prefetch('/questions/details')
    router.prefetch('/sessions/running')
    router.prefetch('/sessions')
  }, [])

  const [creationMode, setCreationMode] = useState(
    (): boolean => !!router.query.creationMode || !!router.query.editSessionId
  )
  const [deletionConfirmation, setDeletionConfirmation] = useState(false)
  const [sessionBlocks, setSessionBlocks] = useState((): any => [])
  const [sessionName, setSessionName] = useState('')

  const [startSession] = useMutation(StartSessionMutation)
  const [createSession] = useMutation(CreateSessionMutation)
  const [archiveQuestions] = useMutation(ArchiveQuestionsMutation)
  const [modifySession] = useMutation(ModifySessionMutation)
  const [deleteQuestions] = useMutation(DeleteQuestionsMutation)
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

  const [index, setIndex] = useState()
  useEffect((): any => {
    if (!data || !data.questions) {
      return
    }

    try {
      // build an index from the received questions
      setIndex(buildIndex('questions', data.questions, ['title', 'createdAt']))
    } catch (e) {
      console.error(e)
    }
  }, [data])

  const [processedQuestions, setProcessedQuestions] = useState()
  useEffect((): any => {
    if (!data || !data.questions) {
      return
    }

    // process questions according to filters and sort settings
    setProcessedQuestions(processItems(data.questions, filters, sort, index))
  }, [data, filters, sort])

  const { editSessionId, copy: copyMode } = router.query

  const onCreationModeToggle = (): void => {
    // if the creation mode was activated before, reset blocks on toggle
    if (creationMode) {
      setCreationMode(false)
      setSessionBlocks([])
    } else {
      // turn on creation mode
      setCreationMode(true)
      setSessionName(dayjs().format('DD.MM.YYYY HH:mm'))
    }
  }

  // override the toggle archive function
  // need to reset the selection on toggling archive to not apply actions to hidden questions
  const onToggleArchive = (): void => {
    handleResetSelection()
    handleToggleArchive()
  }

  // handle archiving a question
  const onArchiveQuestions = async (): Promise<void> => {
    try {
      // archive the questions
      await archiveQuestions({
        refetchQueries: [{ query: QuestionPoolQuery }],
        variables: { ids: selectedItems.ids },
      })

      addToast('Questions successfully archived.', { appearance: 'success' })

      handleResetSelection()
    } catch ({ message }) {
      console.error(message)
      addToast(`Unable to archive questions: ${message}`, {
        appearance: 'error',
        autoDismiss: false,
      })
    }
  }

  // build a single block from all the checked questions
  const onQuickBlock = (): void => {
    // reset the checked questions
    handleResetSelection()

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
  }

  // build a separate block for each checked question
  const onQuickBlocks = (): void => {
    // reset the checked questions
    handleResetSelection()

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
  }

  // handle creating a new session
  const onCreateSession = (type): any => async (e): Promise<void> => {
    // prevent a page reload on submit
    e.preventDefault()

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
          variables: { blocks, id: editSessionId, name: sessionName },
        })
      } else {
        // create a new session
        result = await createSession({
          refetchQueries: [{ query: SessionListQuery }],
          variables: { blocks, name: sessionName },
        })
      }

      // start the session immediately if the respective button was clicked
      if (type === 'start') {
        await startSession({
          refetchQueries: [{ query: SessionListQuery }, { query: RunningSessionQuery }, { query: AccountSummaryQuery }],
          variables: { id: result.data.createSession.id },
        })
        router.push('/sessions/running')
      }

      // disable creation mode
      onCreationModeToggle()

      addToast('Session successfully created. Visit the session list to manage your new session.', {
        appearance: 'success',
      })
    } catch ({ message }) {
      console.error(message)
      addToast(`Unable to create session: ${message}`, {
        appearance: 'error',
        autoDismiss: false,
      })
    }
  }

  // handle deleting questions
  const onDeleteQuestions = async (confirm): Promise<any> => {
    if (!deletionConfirmation) {
      setDeletionConfirmation(true)
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

        handleResetSelection()

        addToast('Questions successfully deleted.', {
          appearance: 'success',
        })
      } catch ({ message }) {
        console.error(message)
        addToast(`Unable to delete questions: ${message}`, {
          appearance: 'error',
          autoDismiss: false,
        })
      }
    }

    setDeletionConfirmation(false)
  }

  const renderActionArea = (runningSessionId): React.ReactElement => {
    if (creationMode) {
      if (editSessionId) {
        return (
          <SessionEditForm
            handleCreateSession={onCreateSession}
            handleCreationModeToggle={onCreationModeToggle}
            handleSetSessionBlocks={setSessionBlocks}
            handleSetSessionName={setSessionName}
            runningSessionId={runningSessionId}
            sessionBlocks={sessionBlocks}
            sessionName={sessionName}
          />
        )
      }

      return (
        <SessionCreationForm
          handleCreateSession={onCreateSession}
          handleCreationModeToggle={onCreationModeToggle}
          handleSetSessionBlocks={setSessionBlocks}
          handleSetSessionName={setSessionName}
          runningSessionId={runningSessionId}
          sessionBlocks={sessionBlocks}
          sessionName={sessionName}
        />
      )
    }

    return null
  }

  return (
    <TeacherLayout
      fixedHeight
      actionArea={renderActionArea(_get(data, 'runningSession.id'))}
      navbar={{
        search: {
          handleSearch: _debounce(handleSearch, 200),
          handleSortByChange,
          handleSortOrderToggle,
          sortBy: sort.by,
          sortingTypes: QUESTION_SORTINGS,
          sortOrder: sort.asc,
          withSorting: true,
        },
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'questionPool' }}
    >
      <div className="questionPool">
        <div className="tagList">
          <TagList
            activeTags={filters.tags}
            activeType={filters.type}
            handleReset={handleReset}
            handleTagClick={handleTagClick}
            handleToggleArchive={onToggleArchive}
            isArchiveActive={filters.archive}
          />
        </div>
        <div className="wrapper">
          {((): React.ReactElement | React.ReactElement[] => {
            if (!data || loading) {
              return <Loader active />
            }

            return [
              <ActionBar
                creationMode={creationMode}
                deletionConfirmation={deletionConfirmation}
                handleArchiveQuestions={onArchiveQuestions}
                handleCreationModeToggle={onCreationModeToggle}
                handleDeleteQuestions={onDeleteQuestions}
                handleQuickBlock={onQuickBlock}
                handleQuickBlocks={onQuickBlocks}
                handleResetItemsChecked={handleResetSelection}
                handleSetItemsChecked={handleSelectItems}
                isArchiveActive={filters.archive}
                itemsChecked={selectedItems.ids}
                questions={processedQuestions}
              />,
              <div className="questionList">
                <QuestionList
                  creationMode={creationMode}
                  isArchiveActive={filters.archive}
                  questions={processedQuestions}
                  selectedItems={selectedItems}
                  onQuestionChecked={handleSelectItem}
                />
              </div>,
            ]
          })()}
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .questionPool {
          display: flex;
          flex-direction: column;
          height: 100%;

          overflow-y: auto;

          .tagList {
            height: 100%;
            flex: 1;
            background: $color-primary-05p;
            padding: 0.5rem;
          }

          .wrapper {
            height: 100%;

            .questionList {
              height: 95%;

              margin: 0 auto;
              max-width: $max-width;

              padding: 1rem;
            }
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;
            overflow-y: auto;

            .tagList {
              overflow-y: auto;
              flex: 0 0 17rem;
              padding: 2rem 1rem;

              border-right: 1px solid $color-primary;
            }

            .wrapper {
              flex: 1;
              padding: 1rem;

              .questionList {
                overflow-y: auto;
                padding: 1rem 1rem 0 0;
              }
            }
          }

          @include desktop-only {
            padding: 0;
          }
        }
      `}</style>
    </TeacherLayout>
  )
}

export default Index
