import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'
import classNames from 'classnames'
import { FaPlus } from 'react-icons/lib/fa'
import { Button } from 'semantic-ui-react'

import { pageWithIntl, withData } from '../../lib'
import { SessionListQuery, RunningSessionQuery } from '../../graphql/queries'
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
  // TODO: replace with the action button component
  const actionButton = (
    <div className="actionButton">
      <button
        className={classNames('ui huge circular primary icon button', {
          active: creationMode,
        })}
        onClick={handleCreationModeToggle}
      >
        <FaPlus />
      </button>
    </div>
  )

  // TODO: create a component for this?
  const actionArea = (
    <div className="creationForm">
      <SessionCreationForm
        onSave={handleCreateSession('save')}
        onStart={handleCreateSession('start')}
        onDiscard={handleCreationModeToggle}
      />

      <style jsx>
        {`
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
        `}
      </style>
    </div>
  )

  return (
    <TeacherLayout
      actionArea={creationMode ? actionArea : actionButton}
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
            <Button>Create Session</Button>
            <Button>Create Question</Button>
          </div>
          <QuestionList
            dropped={droppedQuestions}
            filters={filters}
            creationMode={creationMode}
            onQuestionDropped={handleQuestionDropped}
          />
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';
        
        .buttons {
          margin-bottom: 5px;
        }

        .questionPool {
          display: flex;
          flex-direction: column;
        }

        .tagList {
          flex: 1;
          background: #ebebeb;

          margin-bottom: 1rem;
        }

        .actionButton {
          display: flex;
          flex-direction: row;
          justify-items: flex-end;
        }

        @include desktop-tablet-only {
          .questionPool {
            // workaround for tag list 100%
            position: absolute;
            height: 100%;
            width: 100%;

            flex-flow: row wrap;

            padding: 0;
          }

          .tagList {
            flex: 0 0 auto;

            margin: 0;
            padding: 2rem 0 2rem 0;
          }

          .questionList {
            flex: 1;
            padding: 2rem 0 2rem 1rem;
          }
        }

        @include desktop-only {
          .questionPool {
            // workaround for tag list 100%
            position: absolute;
            height: 100%;
            width: 100%;

            padding: 0;
          }

          .tagList {
            margin: 0;
            padding: 2rem;
          }

          .questionList {
            padding: 2rem 2rem 2rem 1rem;
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
        refetchQueries: [{ query: RunningSessionQuery }],
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
