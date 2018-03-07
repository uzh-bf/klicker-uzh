import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers, withStateHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'
import { Button, Icon } from 'semantic-ui-react'
import Link from 'next/link'
import Router from 'next/router'

import { pageWithIntl, withData, withDnD, withSortingAndFiltering, withLogging } from '../../lib'
import {
  CreateSessionMutation,
  StartSessionMutation,
  AccountSummaryQuery,
  SessionListQuery,
  RunningSessionQuery,
  QuestionPoolQuery,
} from '../../graphql'
import { SessionCreationForm } from '../../components/forms'
import { QuestionList, TagList } from '../../components/questions'
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
  intl: intlShape.isRequired,
  sort: PropTypes.object.isRequired,
}

const Index = ({
  creationMode,
  droppedQuestions,
  intl,
  filters,
  data,
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
        intl={intl}
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
            handleTagClick={handleTagClick}
          />
        </div>
        <div className="wrapper">
          <div className="questionList">
            <div className="buttons">
              {creationMode && (
                <div className="quickCreationButtons">
                  <div className="checkedCounter">
                    <FormattedMessage
                      defaultMessage="{count} items checked."
                      id="questionPool.itemsChecked"
                      values={{
                        count: 1,
                      }}
                    />
                  </div>
                  <Button icon labelPosition="left">
                    <Icon name="lightning" />
                    <FormattedMessage
                      defaultMessage="Split into {num} block{end}"
                      id="questionPool.button.quickCreateSeparate"
                      values={{
                        end: '',
                        num: 1,
                      }}
                    />
                  </Button>
                  <Button icon labelPosition="left">
                    <Icon name="lightning" />
                    <FormattedMessage
                      defaultMessage="Group into one block"
                      id="questionPool.button.quickCreateSingle"
                    />
                  </Button>
                </div>
              )}

              <div className="actionButtons">
                <Link href="/questions/create">
                  <Button primary>
                    <FormattedMessage
                      defaultMessage="Create Question"
                      id="questionPool.button.createQuestion"
                    />
                  </Button>
                </Link>
                <Button primary disabled={!!creationMode} onClick={handleCreationModeToggle}>
                  <FormattedMessage
                    defaultMessage="Create Session"
                    id="questionPool.button.createSession"
                  />
                </Button>
              </div>
            </div>
            <div className="questionListContent">
              <QuestionList
                creationMode={creationMode}
                data={data}
                dropped={droppedQuestions}
                filters={filters}
                sort={sort}
                onQuestionDropped={handleQuestionDropped}
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

              .buttons {
                border: 1px solid $color-primary;

                flex: 0 0 auto;

                padding: 0.5rem;
              }

              .buttons,
              .quickCreationButtons,
              .actionButtons {
                display: flex;
                flex-direction: column;

                > :global(button) {
                  margin-top: 0.5rem;
                }
              }

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
                .buttons,
                .quickCreationButtons,
                .actionButtons {
                  flex-direction: row;

                  > :global(button) {
                    margin: 0;

                    &:not(:last-child) {
                      margin-right: 0.5rem;
                    }
                  }
                }

                .buttons {
                  align-items: flex-end;
                  justify-content: space-between;
                }

                .quickCreationButtons {
                  flex-wrap: wrap;

                  .checkedCounter {
                    flex: 0 0 100%;

                    margin-bottom: 0.5rem;
                  }
                }

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
  withData,
  pageWithIntl,
  graphql(StartSessionMutation, { name: 'startSession' }),
  graphql(CreateSessionMutation, { name: 'createSession' }),
  graphql(QuestionPoolQuery),
  withSortingAndFiltering,
  withStateHandlers(
    {
      creationMode: false,
      droppedQuestions: [],
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
      handleQuestionDropped: ({ droppedQuestions }) => id => ({
        droppedQuestions: [...droppedQuestions, id],
      }),
    },
  ),
  withHandlers({
    // handle creating a new session
    handleCreateSession: ({
      createSession,
      startSession,
      handleCreationModeToggle,
    }) => type => async ({ sessionName, blocks }) => {
      try {
        // prepare blocks for consumption through the api
        const parsedBlocks = blocks.map(({ questions }) => ({
          questions: questions.map(({ id, version }) => ({ question: id, version })),
        }))

        // create a new session
        const result = await createSession({
          refetchQueries: [{ query: SessionListQuery }],
          variables: { blocks: parsedBlocks, name: sessionName },
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
