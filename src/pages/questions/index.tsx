import React, { useState, useEffect } from 'react'
import UUIDv4 from 'uuid'
import _get from 'lodash/get'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import dayjs from 'dayjs'
import { defineMessages, useIntl } from 'react-intl'
import { useQuery, useMutation } from '@apollo/react-hooks'

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
import QuestionListQuery from '../../graphql/queries/QuestionListQuery.graphql'
import SessionEditForm from '../../components/forms/sessionCreation/SessionEditForm'
import SessionCreationForm from '../../components/forms/sessionCreation/SessionCreationForm'
import QuestionList from '../../components/questions/QuestionList'
import TagList from '../../components/questions/TagList'
import ActionBar from '../../components/questions/ActionBar'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { QUESTION_SORTINGS } from '../../constants'

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
  const { data } = useQuery(QuestionPoolQuery)

  const [selectedItems, handleSelectItem, handleResetSelection] = useSelection()
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

  const { editSessionId, copy: copyMode } = router.query

  const onCreationModeToggle = (): void => {
    // if the creation mode was activated before, reset blocks on toggle
    if (creationMode) {
      setCreationMode(false)
      setSessionBlocks([])
    }

    // turn on creation mode
    setCreationMode(true)
    setSessionName(dayjs().format('DD.MM.YYYY HH:mm'))
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
        refetchQueries: [{ query: QuestionListQuery }],
        variables: { ids: selectedItems.ids },
      })

      handleResetSelection()
    } catch ({ message }) {
      // TODO: if anything fails, display the error
      console.error(message)
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
    } catch ({ message }) {
      // TODO: if anything fails, display the error in the form
      console.error(message)
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

            const { questions } = cache.readQuery({ query: QuestionListQuery })
            cache.writeQuery({
              data: {
                questions: questions.filter((question): boolean => !questionIds.includes(question.id)),
              },
              query: QuestionListQuery,
            })

            setDeletionConfirmation(false)
          },
          variables: { ids: questionIds },
        })

        handleResetSelection()
      } catch ({ message }) {
        // TODO: if anything fails, display the error
        console.error(message)
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
          <div className="questionList">
            <ActionBar
              creationMode={creationMode}
              deletionConfirmation={deletionConfirmation}
              handleArchiveQuestions={onArchiveQuestions}
              handleCreationModeToggle={onCreationModeToggle}
              handleDeleteQuestions={onDeleteQuestions}
              handleQuickBlock={onQuickBlock}
              handleQuickBlocks={onQuickBlocks}
              isArchiveActive={filters.archive}
              itemsChecked={selectedItems.ids.length}
            />

            <div className="questionListContent">
              <QuestionList
                creationMode={creationMode}
                filters={filters}
                isArchiveActive={filters.archive}
                selectedItems={selectedItems}
                sort={sort}
                onQuestionChecked={handleSelectItem}
              />
            </div>
          </div>
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
            min-width: 5rem;

            flex: 1;
            background: $color-primary-05p;
            padding: 0.5rem;
          }

          .wrapper {
            height: 100%;

            .questionList {
              height: 100%;

              display: flex;
              flex-direction: column;

              margin: 0 auto;
              max-width: $max-width;

              .questionListContent {
                flex: 1;
                height: 100%;

                padding: 1rem;
              }
            }
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;
            overflow-y: auto;

            .tagList {
              overflow-y: auto;
              flex: 0 0 auto;
              padding: 2rem 1rem;

              border-right: 1px solid $color-primary;
            }

            .wrapper {
              flex: 1;
              padding: 1rem;

              .questionList {
                .questionListContent {
                  overflow-y: auto;
                  padding: 1rem 1rem 0 0;
                }
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
