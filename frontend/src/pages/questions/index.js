import React from 'react'
import PropTypes from 'prop-types'
import UUIDv4 from 'uuid'
import _get from 'lodash/get'
import _debounce from 'lodash/debounce'
import Router, { withRouter } from 'next/router'
import dayjs from 'dayjs'
import { List } from 'immutable'
import { DragDropContext } from 'react-beautiful-dnd'
import { compose, withHandlers, withStateHandlers, branch, renderNothing, withProps, lifecycle } from 'recompose'
import { defineMessages, intlShape } from 'react-intl'
import { graphql, Query } from 'react-apollo'

import { pageWithIntl, withDnD, withSortingAndFiltering, withLogging, withSelection } from '../../lib'
import {
  CreateSessionMutation,
  StartSessionMutation,
  AccountSummaryQuery,
  SessionListQuery,
  RunningSessionQuery,
  QuestionPoolQuery,
  ArchiveQuestionsMutation,
  SessionDetailsQuery,
  ModifySessionMutation,
  DeleteQuestionsMutation,
  QuestionListQuery,
} from '../../graphql'
// import { SessionCreationForm } from '../../components/forms'
import SessionCreationForm from '../../components/forms/sessionCreation/SessionCreationForm'
import { QuestionList, TagList, ActionBar } from '../../components/questions'
import { TeacherLayout } from '../../components/layouts'
import { QUESTION_SORTINGS } from '../../constants'
import { removeQuestion, moveQuestion, addToBlock, appendNewBlock } from '../../lib/utils/move'

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

const propTypes = {
  creationMode: PropTypes.bool.isRequired,
  deletionConfirmation: PropTypes.bool.isRequired,
  filters: PropTypes.object.isRequired,
  handleArchiveQuestions: PropTypes.func.isRequired,
  handleChangeName: PropTypes.func.isRequired,
  handleCreateSession: PropTypes.func.isRequired,
  handleCreationModeToggle: PropTypes.func.isRequired,
  handleDeleteQuestions: PropTypes.bool.isRequired,
  handleExtendBlock: PropTypes.func.isRequired,
  handleManageBlocks: PropTypes.func.isRequired,
  handleNewBlock: PropTypes.func.isRequired,
  handleQuickBlock: PropTypes.func.isRequired,
  handleQuickBlocks: PropTypes.func.isRequired,
  handleRemoveQuestion: PropTypes.func.isRequired,
  handleReset: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  handleSelectItem: PropTypes.func.isRequired,
  handleSortByChange: PropTypes.func.isRequired,
  handleSortOrderToggle: PropTypes.func.isRequired,
  handleTagClick: PropTypes.func.isRequired,
  handleToggleArchive: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  numSelectedItems: PropTypes.number.isRequired,
  selectedItems: PropTypes.any.isRequired,
  sessionBlocks: PropTypes.any.isRequired,
  sessionInteractionType: PropTypes.oneOf(['CREATE', 'COPY', 'MODIFY']).isRequired,
  sessionName: PropTypes.string.isRequired,
  sort: PropTypes.object.isRequired,
}

const Index = ({
  numSelectedItems,
  creationMode,
  deletionConfirmation,
  intl,
  filters,
  sort,
  selectedItems,
  sessionName,
  sessionBlocks,
  sessionInteractionType,
  handleSelectItem,
  handleCreateSession,
  handleDeleteQuestions,
  handleNewBlock,
  handleManageBlocks,
  handleExtendBlock,
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  handleTagClick,
  handleCreationModeToggle,
  handleQuickBlock,
  handleQuickBlocks,
  handleReset,
  handleRemoveQuestion,
  handleToggleArchive,
  handleChangeName,
  handleArchiveQuestions,
}) => {
  const creationForm = runningSessionId => (
    <div className="creationForm">
      <DragDropContext onDragEnd={handleManageBlocks}>
        <SessionCreationForm
          blocks={sessionBlocks}
          handleChangeName={handleChangeName}
          handleDiscard={handleCreationModeToggle}
          handleExtendBlock={handleExtendBlock}
          handleNewBlock={handleNewBlock}
          handleRemoveQuestion={handleRemoveQuestion}
          handleSubmit={handleCreateSession}
          interactionType={sessionInteractionType}
          intl={intl}
          isSessionRunning={!!runningSessionId}
          name={sessionName}
        />
      </DragDropContext>

      <style jsx>{`
        .creationForm {
          animation-name: slide-in;
          animation-duration: 0.75s;
        }

        @keyframes slide-in {
          0% {
            transform: translateY(300px);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )

  return (
    <Query query={QuestionPoolQuery}>
      {({ data }) => (
        <TeacherLayout
          fixedHeight
          actionArea={creationMode ? creationForm(_get(data, 'runningSession.id')) : null}
          intl={intl}
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
                handleToggleArchive={handleToggleArchive}
                isArchiveActive={filters.archive}
              />
            </div>
            <div className="wrapper">
              <div className="questionList">
                <ActionBar
                  creationMode={creationMode}
                  deletionConfirmation={deletionConfirmation}
                  handleArchiveQuestions={handleArchiveQuestions}
                  handleCreationModeToggle={handleCreationModeToggle}
                  handleDeleteQuestions={handleDeleteQuestions}
                  handleQuickBlock={handleQuickBlock}
                  handleQuickBlocks={handleQuickBlocks}
                  intl={intl}
                  isArchiveActive={filters.archive}
                  itemsChecked={numSelectedItems}
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
      )}
    </Query>
  )
}

Index.propTypes = propTypes

export default compose(
  lifecycle({
    componentDidMount() {
      Router.prefetch('/questions/details')
      Router.prefetch('/sessions/running')
      Router.prefetch('/sessions')
    },
  }),
  withLogging({
    slaask: true,
  }),
  withDnD,
  pageWithIntl,
  withSortingAndFiltering,
  withSelection,
  graphql(StartSessionMutation, { name: 'startSession' }),
  graphql(CreateSessionMutation, { name: 'createSession' }),
  graphql(ArchiveQuestionsMutation, { name: 'archiveQuestions' }),
  graphql(ModifySessionMutation, { name: 'modifySession' }),
  graphql(DeleteQuestionsMutation, { name: 'deleteQuestions' }),
  withRouter,
  withProps(({ router: { query } }) => ({
    creationMode: !!query.creationMode,
  })),
  branch(
    // if we are in session modification mode, branch away from the main data flow
    ({ router: { query } }) => !!query.editSessionId,
    // compose the relevant HOCs into a single one
    compose(
      // fetch session details
      graphql(SessionDetailsQuery, {
        name: 'editSessionDetails',
        options: ({ router: { query } }) => ({
          variables: { id: query.editSessionId },
        }),
      }),
      // stall loading of the page until the session details have been fetched
      branch(({ editSessionDetails }) => typeof editSessionDetails.session === 'undefined', renderNothing),
      // convert the fetched session details into usable initial state (name and blocks)
      withProps(({ editSessionDetails: { session }, router: { query } }) => {
        // define a function that parses session block details into immutable client side state
        // that will serve as initial state for the edit form
        const parseInitialBlocks = () =>
          List(
            session.blocks.map(({ id, instances }) => ({
              id,
              key: id,
              questions: List(
                instances.map(({ question, version }) => ({
                  id: question.id,
                  title: question.title,
                  type: question.type,
                  version,
                }))
              ),
            }))
          )

        const getInteractionType = () => {
          if (session.id) {
            if (query.copy) {
              return 'COPY'
            }
            return 'MODIFY'
          }
          return 'CREATE'
        }

        return {
          sessionBlocks: parseInitialBlocks(),
          sessionCopyMode: !!query.copy,
          sessionEditMode: session.id,
          sessionId: session.id,
          sessionInteractionType: getInteractionType(),
          sessionName: query.copy ? `${session.name} Copy` : session.name,
        }
      })
    )
  ),
  withStateHandlers(
    ({ creationMode, sessionEditMode, sessionBlocks, sessionName }) => ({
      creationMode: !!sessionEditMode || !!creationMode,
      deletionConfirmation: false,
      sessionBlocks: sessionBlocks || List([]),
      sessionName,
    }),
    {
      // handlers for session creation form fields
      handleChangeName: () => e => ({ sessionName: e.target.value }),

      // handle toggling creation mode (display of session creation form)
      handleCreationModeToggle: ({ creationMode }) => () => {
        // if the creation mode was activated before, reset blocks on toggle
        if (creationMode) {
          return {
            creationMode: false,
            sessionBlocks: List([]),
          }
        }

        // turn on creation mode
        return {
          creationMode: true,
          sessionName: dayjs().format('DD.MM.YYYY HH:mm'),
        }
      },

      handleExtendBlock: ({ sessionBlocks }) => (blockId, question) => ({
        sessionBlocks: addToBlock(sessionBlocks, blockId, question),
      }),

      handleManageBlocks: ({ sessionBlocks }) => ({ source, destination }) => {
        if (!source || !destination) {
          return null
        }

        // if the item was dropped in a new block
        if (destination.droppableId === 'new-block') {
          // generate a new uuid for the new block
          const blockId = UUIDv4()

          // initialize a new empty block at the end
          const extendedBlocks = sessionBlocks.push({
            id: blockId,
            questions: List(),
          })

          // perform the move between the source and the new block
          return {
            sessionBlocks: moveQuestion(extendedBlocks, source.droppableId, source.index, blockId, 0, true),
          }
        }

        return {
          sessionBlocks: moveQuestion(
            sessionBlocks,
            source.droppableId,
            source.index,
            destination.droppableId,
            destination.index,
            true
          ),
        }
      },

      handleNewBlock: ({ sessionBlocks }) => question => ({
        sessionBlocks: appendNewBlock(sessionBlocks, question),
      }),

      // build a single block from all the checked questions
      handleQuickBlock: ({ sessionBlocks }, { handleResetSelection, selectedItems }) => () => {
        // reset the checked questions
        handleResetSelection()

        return {
          sessionBlocks: sessionBlocks.push({
            id: UUIDv4(),
            questions: selectedItems.toList().map(({ id, title, type, version }) => ({
              id,
              key: UUIDv4(),
              title,
              type,
              version,
            })),
          }),
        }
      },

      // build a separate block for each checked question
      handleQuickBlocks: ({ sessionBlocks }, { handleResetSelection, selectedItems }) => () => {
        // reset the checked questions
        handleResetSelection()

        return {
          sessionBlocks: sessionBlocks.concat(
            selectedItems.toList().map(({ id, title, type, version }) => ({
              id: UUIDv4(),
              questions: List([
                {
                  id,
                  key: UUIDv4(),
                  title,
                  type,
                  version,
                },
              ]),
            }))
          ),
        }
      },

      // handle removal of a question with its trash button
      handleRemoveQuestion: ({ sessionBlocks }) => (blockIndex, questionIndex) => ({
        sessionBlocks: removeQuestion(sessionBlocks, blockIndex, questionIndex, true),
      }),

      handleSetDeletionConfirmation: () => deletionConfirmation => ({
        deletionConfirmation,
      }),

      // override the toggle archive function
      // need to reset the selection on toggling archive to not apply actions to hidden questions
      handleToggleArchive: (_, { handleResetSelection, handleToggleArchive }) => () => {
        handleResetSelection()
        handleToggleArchive()
      },
    }
  ),
  withHandlers({
    // handle archiving a question
    handleArchiveQuestions: ({ archiveQuestions, handleResetSelection, selectedItems }) => async () => {
      try {
        // archive the questions
        await archiveQuestions({
          refetchQueries: [{ query: QuestionListQuery }],
          variables: { ids: [...selectedItems.keys()] },
        })

        handleResetSelection()
      } catch ({ message }) {
        // TODO: if anything fails, display the error
        console.error(message)
      }
    },

    // handle creating a new session
    handleCreateSession: ({
      sessionId,
      sessionCopyMode,
      sessionEditMode,
      sessionName,
      sessionBlocks,
      createSession,
      modifySession,
      startSession,
      handleCreationModeToggle,
    }) => type => async e => {
      // prevent a page reload on submit
      e.preventDefault()

      try {
        // prepare blocks for consumption through the api
        const blocks = sessionBlocks.map(({ questions }) => ({
          questions: questions.map(({ id, version = 0 }) => ({
            question: id,
            version,
          })),
        }))

        let result
        if (sessionEditMode && !sessionCopyMode) {
          // modify an existing session
          result = await modifySession({
            refetchQueries: [{ query: SessionListQuery }],
            variables: { blocks, id: sessionId, name: sessionName },
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
            refetchQueries: [
              { query: SessionListQuery },
              { query: RunningSessionQuery },
              { query: AccountSummaryQuery },
            ],
            variables: { id: result.data.createSession.id },
          })
          Router.push('/sessions/running')
        }

        // disable creation mode
        handleCreationModeToggle()
      } catch ({ message }) {
        // TODO: if anything fails, display the error in the form
        console.error(message)
      }
    },

    // handle deleting questions
    handleDeleteQuestions: ({
      deleteQuestions,
      deletionConfirmation,
      handleResetSelection,
      handleSetDeletionConfirmation,
      selectedItems,
    }) => async confirm => {
      if (!deletionConfirmation) {
        handleSetDeletionConfirmation(true)
        return
      }

      if (confirm) {
        try {
          const questionIds = Array.from(selectedItems.keys())
          await deleteQuestions({
            optimisticResponse: {
              __typename: 'Mutation',
              deleteQuestions: 'DELETION_SUCCESSFUL',
            },
            update: (cache, { data }) => {
              if (data.deleteQuestions !== 'DELETION_SUCCESSFUL') {
                return
              }

              const { questions } = cache.readQuery({ query: QuestionListQuery })
              cache.writeQuery({
                data: {
                  questions: questions.filter(question => !questionIds.includes(question.id)),
                },
                query: QuestionListQuery,
              })

              handleSetDeletionConfirmation(false)
            },
            variables: { ids: questionIds },
          })

          handleResetSelection()
        } catch ({ message }) {
          // TODO: if anything fails, display the error
          console.error(message)
        }
      }

      handleSetDeletionConfirmation(false)
    },
  })
)(Index)
