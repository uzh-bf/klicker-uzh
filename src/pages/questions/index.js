import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers, withStateHandlers } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'
import Router from 'next/router'
import moment from 'moment'

import {
  pageWithIntl,
  withData,
  withDnD,
  withSortingAndFiltering,
  withLogging,
  withSelection,
} from '../../lib'
import {
  CreateSessionMutation,
  StartSessionMutation,
  AccountSummaryQuery,
  SessionListQuery,
  RunningSessionQuery,
  QuestionPoolQuery,
} from '../../graphql'
// import { SessionCreationForm } from '../../components/forms'
import SessionCreationForm from '../../components/forms/SessionCreationForm2'
import { QuestionList, TagList, ActionBar } from '../../components/questions'
import { TeacherLayout } from '../../components/layouts'
import { QUESTION_SORTINGS } from '../../constants'

const propTypes = {
  creationMode: PropTypes.bool.isRequired,
  data: PropTypes.object.isRequired,
  droppedQuestions: PropTypes.arrayOf(PropTypes.string).isRequired,
  filters: PropTypes.object.isRequired,
  handleCreateSession: PropTypes.func.isRequired,
  handleCreationModeToggle: PropTypes.func.isRequired,
  handleQuestionDropped: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  handleSortByChange: PropTypes.func.isRequired,
  handleSortOrderToggle: PropTypes.func.isRequired,
  handleTagClick: PropTypes.func.isRequired,
  initialBlocks: PropTypes.arrayOf(PropTypes.object).isRequired,
  intl: intlShape.isRequired,
  numSelectedItems: PropTypes.number.isRequired,
  sort: PropTypes.object.isRequired,
}

const Index = ({
  numSelectedItems,
  creationMode,
  intl,
  filters,
  data,
  sort,
  selectedItems,
  sessionName,
  sessionBlocks,
  handleResetSelection,
  handleSelectItem,
  handleCreateSession,
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  handleTagClick,
  handleCreationModeToggle,
  handleQuickBlock,
  handleQuickBlocks,
  handleReset,
  handleToggleArchive,
  handleChangeName,
  handleChangeBlocks,
}) => {
  // TODO: create a component for this?
  const actionArea = (
    <div className="creationForm">
      <SessionCreationForm
        // initialBlocks={initialBlocks}
        blocks={sessionBlocks}
        handleChangeBlocks={handleChangeBlocks}
        handleChangeName={handleChangeName}
        handleDiscard={handleCreationModeToggle}
        handleSubmit={handleCreateSession}
        intl={intl}
        name={sessionName}
      />

      <style jsx>{`
        .creationForm {
          animation-name: slide-in;
          animation-duration: 0.5s;
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
    <TeacherLayout
      fixedHeight
      actionArea={creationMode ? actionArea : null}
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
        title: intl.formatMessage({
          defaultMessage: 'Question Pool',
          id: 'questionPool.title',
        }),
      }}
      pageTitle={intl.formatMessage({
        defaultMessage: 'Question Pool',
        id: 'questionPool.pageTitle',
      })}
      sidebar={{ activeItem: 'questionPool' }}
    >
      <div className="questionPool">
        <div className="tagList">
          <TagList
            activeTags={filters.tags}
            activeType={filters.type}
            data={data}
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
              handleCreationModeToggle={handleCreationModeToggle}
              handleQuickBlock={handleQuickBlock}
              handleQuickBlocks={handleQuickBlocks}
              itemsChecked={numSelectedItems}
            />

            <div className="questionListContent">
              <QuestionList
                creationMode={creationMode}
                data={data}
                filters={filters}
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
            background: $color-primary-10p;
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

Index.propTypes = propTypes

export default compose(
  withLogging(),
  withDnD,
  pageWithIntl,
  withData,
  graphql(StartSessionMutation, { name: 'startSession' }),
  graphql(CreateSessionMutation, { name: 'createSession' }),
  graphql(QuestionPoolQuery),
  withSortingAndFiltering,
  withSelection,
  withStateHandlers(
    {
      creationMode: false,
      sessionBlocks: [],
      sessionName: moment().format('DD.MM.YYYY HH:mm'),
    },
    {
      // handlers for session creation form fields
      handleChangeBlocks: () => sessionBlocks => ({ sessionBlocks }),
      handleChangeName: () => sessionName => ({ sessionName }),

      // handle toggling creation mode (display of session creation form)
      handleCreationModeToggle: ({ creationMode }) => () => {
        // if the creation mode was activated before, reset blocks on toggle
        if (creationMode) {
          return {
            creationMode: false,
            sessionBlocks: [],
          }
        }

        // turn on creation mode
        return { creationMode: true }
      },

      // build a single block from all the checked questions
      handleQuickBlock: ({ sessionBlocks }, { handleResetSelection, selectedItems }) => () => {
        // reset the checked questions
        handleResetSelection()

        return {
          sessionBlocks: [
            ...sessionBlocks,
            {
              questions: selectedItems.toIndexedSeq().toArray(),
            },
          ],
        }
      },

      // build a separate block for each checked question
      handleQuickBlocks: ({ sessionBlocks }, { handleResetSelection, selectedItems }) => () => {
        // reset the checked questions
        handleResetSelection()

        return {
          sessionBlocks: [
            ...sessionBlocks,
            ...selectedItems
              .toIndexedSeq()
              .toArray()
              .map(item => ({
                questions: [item],
              })),
          ],
        }
      },
    },
  ),
  withHandlers({
    // handle creating a new session
    handleCreateSession: ({
      sessionName,
      sessionBlocks,
      createSession,
      startSession,
      handleCreationModeToggle,
    }) => type => async () => {
      try {
        // prepare blocks for consumption through the api
        const blocks = sessionBlocks.map(({ questions }) => ({
          questions: questions.map(({ id, version }) => ({ question: id, version })),
        }))

        // create a new session
        const result = await createSession({
          refetchQueries: [{ query: SessionListQuery }],
          variables: { blocks, name: sessionName },
        })

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
  }),
)(Index)
