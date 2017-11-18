import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'
import { Button } from 'semantic-ui-react'
import Link from 'next/link'

import { pageWithIntl, withData } from '../../lib'
import { AccountSummaryQuery, SessionListQuery, RunningSessionQuery } from '../../graphql/queries'
import { CreateSessionMutation, StartSessionMutation } from '../../graphql/mutations'
import { SessionCreationForm } from '../../components/forms'
import { QuestionList, TagList } from '../../components/questions'
import { TeacherLayout } from '../../components/layouts'

const propTypes = {
  creationMode: PropTypes.bool.isRequired,
  droppedQuestions: PropTypes.arrayOf(PropTypes.string).isRequired,
  filters: PropTypes.object.isRequired,
  handleCreateSession: PropTypes.func.isRequired,
  handleCreationModeToggle: PropTypes.func.isRequired,
  handleQuestionDropped: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  handleSort: PropTypes.func.isRequired,
  handleTagClick: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const Index = ({
  creationMode,
  droppedQuestions,
  intl,
  filters,
  handleCreateSession,
  handleSearch,
  handleSort,
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
      actionArea={creationMode ? actionArea : null}
      intl={intl}
      navbar={{
        search: {
          handleSearch: _debounce(handleSearch, 200),
          handleSort,
          sortBy: '',
          sortOrder: '',
        },
        title: intl.formatMessage({
          defaultMessage: 'Question Pool',
          id: 'teacher.questionPool.title',
        }),
      }}
      pageTitle={intl.formatMessage({
        defaultMessage: 'Question Pool',
        id: 'teacher.questionPool.pageTitle',
      })}
      sidebar={{ activeItem: 'questionPool' }}
    >
      <div className="questionPool">
        <div className="tagList">
          <TagList activeTags={filters.tags} handleTagClick={handleTagClick} />
        </div>
        <div className="questionList">
          <div className="buttons">
            <Button onClick={handleCreationModeToggle}>
              <FormattedMessage
                defaultMessage="Create Session"
                id="questionPool.button.createSession"
              />
            </Button>
            <Link href="/questions/create">
              <Button>
                <FormattedMessage
                  defaultMessage="Create Question"
                  id="questionPool.button.createQuestion"
                />
              </Button>
            </Link>
          </div>
          <QuestionList
            creationMode={creationMode}
            dropped={droppedQuestions}
            filters={filters}
            onQuestionDropped={handleQuestionDropped}
          />
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .questionPool {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: #f5f5f5;

          .questionList {
            // HACK: workaround for creating session div overlapping the question list
            padding: 1rem;
            padding-bottom: 235px;

            .buttons {
              margin: 0 0 1rem 0;

              display: flex;
              justify-content: center;

              > :global(button:last-child) {
                margin-right: 0;
              }
            }
          }

          .tagList {
            flex: 1;
            background: #ebebeb;
            padding: 0.5rem;
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;

            .tagList {
              flex: 0 0 auto;
              padding: 1rem;
            }

            .questionList {
              flex: 1;
              padding: 1rem;

              .buttons {
                display: flex;
                justify-content: flex-end;
              }
            }
          }

          @include desktop-only {
            padding: 0;

            .tagList {
              padding: 2rem;
            }

            .questionList {
              padding: 2rem;
            }
          }
        }
      `}</style>
    </TeacherLayout>
  )
}

Index.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  withState('creationMode', 'setCreationMode', false),
  withState('droppedQuestions', 'setDroppedQuestions', []),
  withState('filters', 'setFilters', {
    tags: [],
    title: null,
    type: null,
  }),
  withHandlers({
    // handle toggling creation mode (display of session creation form)
    handleCreationModeToggle: ({ creationMode, setCreationMode, setDroppedQuestions }) => () => {
      // if the creation mode was activated before, reset dropped questions on toggle
      if (creationMode) {
        setDroppedQuestions([])
      }

      // toggle creation mode
      setCreationMode(prevState => !prevState)
    },

    // handle a new question that gets dropped on the session creation timeline
    handleQuestionDropped: ({ setDroppedQuestions }) => id => () =>
      setDroppedQuestions(prevState => [...prevState, id]),

    // handle an update in the search bar
    handleSearch: ({ setFilters }) => title => setFilters(prevState => ({ ...prevState, title })),

    // handle updated sort settings
    handleSort: () => (by, order) => {
      console.log(`sorted by ${by} in ${order} order`)
    },

    // handle clicking on a tag in the tag list
    handleTagClick: ({ setFilters }) => tagName =>
      setFilters((prevState) => {
        // remove the tag from active tags
        if (prevState.tags.includes(tagName)) {
          return {
            ...prevState,
            tags: prevState.tags.filter(tag => tag !== tagName),
          }
        }

        // add the tag to active tags
        return {
          ...prevState,
          tags: [...prevState.tags, tagName],
        }
      }),
  }),
  graphql(StartSessionMutation),
  withHandlers({
    // handle starting an existing or newly created session
    handleStartSession: ({ mutate }) => id =>
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
    }) => type => async ({ sessionName, questions }) => {
      try {
        // HACK: map each question into a separate question block
        const blocks = questions.map(question => ({ questions: [question.id] }))

        // create a new session
        const result = await mutate({
          refetchQueries: [{ query: SessionListQuery }],
          variables: { blocks, name: sessionName },
        })

        // start the session immediately if the respective button was clicked
        if (type === 'start') {
          await handleStartSession({ id: result.data.createSession.id })
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
