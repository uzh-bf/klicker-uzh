import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers, withStateHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'
import { Button } from 'semantic-ui-react'
import Link from 'next/link'
import Router from 'next/router'

import { pageWithIntl, withData, withDnD, withSorting, withLogging } from '../../lib'
import {
  CreateSessionMutation,
  StartSessionMutation,
  AccountSummaryQuery,
  SessionListQuery,
  RunningSessionQuery,
  QuestionListQuery,
} from '../../graphql'
import { SessionCreationForm } from '../../components/forms'
import { QuestionList, TagList } from '../../components/questions'
import { TeacherLayout } from '../../components/layouts'
import { QUESTION_SORTINGS } from '../../constants'

const propTypes = {
  creationMode: PropTypes.bool.isRequired,
  droppedQuestions: PropTypes.arrayOf(PropTypes.string).isRequired,
  filters: PropTypes.object.isRequired,
  sort: PropTypes.object.isRequired,
  handleCreateSession: PropTypes.func.isRequired,
  handleCreationModeToggle: PropTypes.func.isRequired,
  handleQuestionDropped: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  handleSortByChange: PropTypes.func.isRequired,
  handleSortOrderToggle: PropTypes.func.isRequired,
  handleTagClick: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const Index = ({
  creationMode,
  droppedQuestions,
  intl,
  filters,
  sort,
  handleCreateSession,
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  handleTagClick,
  handleQuestionDropped,
  handleCreationModeToggle,
}) => {
  // TODO: create a component for this?
  const actionArea = (
    <div className="creationForm">
      <SessionCreationForm
        onDiscard={handleCreationModeToggle}
        onSave={handleCreateSession('save')}
        onStart={handleCreateSession('start')}
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
            handleTagClick={handleTagClick}
          />
        </div>
        <div className="wrapper">
          <div className="questionList">
            <div className="buttons">
              <Link href="/questions/create">
                <Button>
                  <FormattedMessage
                    defaultMessage="Create Question"
                    id="questionPool.button.createQuestion"
                  />
                </Button>
              </Link>
              <Button onClick={handleCreationModeToggle}>
                <FormattedMessage
                  defaultMessage="Create Session"
                  id="questionPool.button.createSession"
                />
              </Button>
            </div>
            <QuestionList
              creationMode={creationMode}
              dropped={droppedQuestions}
              filters={filters}
              sort={sort}
              onQuestionDropped={handleQuestionDropped}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .questionPool {
          display: flex;
          flex-direction: column;
          height: 100%;

          .tagList {
            overflow-y: auto;
            height: 100%;

            flex: 1;
            background: $color-primary-10p;
            padding: 0.5rem;
          }

          .wrapper {
            height: 100%;

            .questionList {
              height: 100%;
              overflow-y: auto;

              padding: 1rem;

              margin: 0 auto;
              max-width: $max-width;

              .buttons {
                margin: 0 0 1rem 0;

                display: flex;
                justify-content: center;

                > :global(button) {
                  margin-right: 0;

                  &:first-child {
                    margin-right: 0.5rem;
                  }
                }
              }
            }
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;

            .tagList {
              flex: 0 0 auto;
              padding: 2rem 1rem;
            }

            .wrapper {
              flex: 1;
              padding: 1rem;

              .questionList {
                .buttons {
                  display: flex;
                  justify-content: flex-end;
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
  withLogging,
  withDnD,
  withData,
  pageWithIntl,
  withSorting,
  withStateHandlers(
    {
      creationMode: false,
      droppedQuestions: [],
      filters: {
        tags: [],
        title: null,
        type: null,
      },
    },
    {
      // handle toggling creation mode (display of session creation form)
      handleCreationModeToggle: ({ creationMode }) => () => {
        // if the creation mode was activated before, reset dropped questions on toggle
        if (creationMode) {
          return {
            creationMode: false,
            droppedQuestions: [],
          }
        }

        // turn on creation mode
        return { creationMode: true }
      },

      // handle a new question that gets dropped on the session creation timeline
      handleQuestionDropped: ({ droppedQuestions }) => id => () => ({
        droppedQuestions: [...droppedQuestions, id],
      }),

      // handle an update in the search bar
      handleSearch: ({ filters }) => title => ({ filters: { ...filters, title } }),

      // handle clicking on a tag in the tag list
      handleTagClick: ({ filters }) => (tagName, questionType = false) => {
        // if the changed tag is a question type tag
        if (questionType) {
          if (filters.type === tagName) {
            return { filters: { ...filters, type: null } }
          }

          // add the tag to active tags
          return { filters: { ...filters, type: tagName } }
        }

        // remove the tag from active tags
        if (filters.tags.includes(tagName)) {
          return {
            filters: {
              ...filters,
              tags: filters.tags.filter(tag => tag !== tagName),
            },
          }
        }

        // add the tag to active tags
        return {
          filters: {
            ...filters,
            tags: [...filters.tags, tagName],
          },
        }
      },
    },
  ),
  graphql(StartSessionMutation),
  withHandlers({
    // handle starting an existing or newly created session
    handleStartSession: ({ mutate }) => ({ id }) =>
      mutate({
        refetchQueries: [{ query: RunningSessionQuery }, { query: AccountSummaryQuery }],
        variables: { id },
      }),
  }),
  graphql(CreateSessionMutation),
  withHandlers({
    // handle creating a new session
    handleCreateSession: ({
      mutate,
      handleCreationModeToggle,
      handleStartSession,
    }) => type => async ({ sessionName, blocks }) => {
      try {
        // prepare blocks for consumption through the api
        const parsedBlocks = blocks.map(({ questions }) => ({
          questions: questions.map(({ id, version }) => ({ question: id, version })),
        }))

        // create a new session
        const result = await mutate({
          refetchQueries: [{ query: QuestionListQuery, SessionListQuery }],
          variables: { blocks: parsedBlocks, name: sessionName },
        })

        // start the session immediately if the respective button was clicked
        if (type === 'start') {
          await handleStartSession({ id: result.data.createSession.id })
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
