import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import _debounce from 'lodash/debounce'
import classNames from 'classnames'
import { FaPlus } from 'react-icons/lib/fa'

import { pageWithIntl, withData } from '../../lib'
import { SessionListQuery, RunningSessionQuery } from '../../queries/queries'
import { CreateSessionMutation, StartSessionMutation } from '../../queries/mutations'
import SessionCreationForm from '../../components/forms/SessionCreationForm'
import QuestionList from '../../components/questions/QuestionList'
import TagList from '../../components/questions/TagList'
import TeacherLayout from '../../components/layouts/TeacherLayout'

const propTypes = {
  createSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  startSession: PropTypes.func.isRequired,
}

class Index extends React.Component {
  state = {
    creationMode: false,
    dropped: [],
    filters: {
      tags: [],
      title: null,
      type: null,
    },
  }

  toggleCreationMode = () => {
    // : void => {
    this.setState((prevState) => {
      // toggle creation mode
      const creationMode = !prevState.creationMode

      // if the creation mode was activated before, reset dropped questions on discard
      if (!creationMode) {
        return { creationMode, dropped: [] }
      }

      return { creationMode }
    })
  }

  handleDropped = id => () => {
    // (id: string) => () => {
    this.setState(prevState => ({ dropped: [...prevState.dropped, id] }))
  }

  // handle searching in the navbar search area
  handleSearch = (title) => {
    // (title: string): void => {
    this.setState(prevState => ({
      filters: { ...prevState.filters, title },
    }))
  }

  // handle sorting via navbar search area
  handleSort = (by, order) => {
    // (by: string, order: string): void => {
    console.log(`sorted by ${by} in ${order} order`)
  }

  // handle clicking on a tag in the tag list
  handleTagClick = (tagName) => {
    // (tagName: string): void => {
    this.setState((prevState) => {
      // remove the tag from active tags
      if (prevState.filters.tags.includes(tagName)) {
        return {
          filters: {
            ...prevState.filters,
            tags: prevState.filters.tags.filter(tag => tag !== tagName),
          },
        }
      }

      // add the tag to active tags
      return {
        filters: {
          ...prevState.filters,
          tags: [...prevState.filters.tags, tagName],
        },
      }
    })
  }

  handleNewSession = type => async ({ sessionName, questions }) => {
    // HACK: map each question into a separate question block
    const blocks = questions.map(question => ({ questions: [{ id: question.id }] }))

    try {
      // create a new session
      const result = await this.props.createSession({ blocks, name: sessionName })

      // start the session immediately if the respective button was clicked
      if (type === 'start') {
        await this.props.startSession({ id: result.data.createSession.id })
      }

      // disable creation mode
      this.toggleCreationMode()
    } catch ({ message }) {
      // TODO: if anything fails, display the error in the form
      console.error(message)
    }
  }

  render() {
    const { intl } = this.props
    const { creationMode, dropped, filters } = this.state

    const navbarConfig = {
      accountShort: 'AW',
      search: {
        handleSearch: _debounce(this.handleSearch, 200),
        handleSort: this.handleSort,
        query: '',
        sortBy: '',
        sortOrder: '',
      },
      title: intl.formatMessage({
        defaultMessage: 'Question Pool',
        id: 'teacher.questionPool.title',
      }),
    }

    // TODO: replace with the action button component
    const actionButton = (
      <div className="actionButton">
        <button
          className={classNames('ui huge circular primary icon button', {
            active: creationMode,
          })}
          onClick={this.toggleCreationMode}
        >
          <FaPlus />
        </button>
      </div>
    )

    // TODO: create a component for this?
    const actionArea = (
      <div className="creationForm">
        <SessionCreationForm
          onSave={this.handleNewSession('save')}
          onStart={this.handleNewSession('start')}
          onDiscard={this.toggleCreationMode}
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
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Question Pool',
          id: 'teacher.questionPool.pageTitle',
        })}
        sidebar={{ activeItem: 'questionPool' }}
      >
        <div className="questionPool">
          <div className="tagList">
            <TagList activeTags={filters.tags} handleTagClick={this.handleTagClick} />
          </div>
          <div className="questionList">
            <QuestionList
              dropped={dropped}
              filters={filters}
              creationMode={creationMode}
              onQuestionDropped={this.handleDropped}
            />
          </div>
        </div>

        <style jsx>
          {`
            .questionPool {
              display: flex;
              flex-direction: column;

              padding: 1rem;
            }

            .tagList {
              flex: 1;

              margin-bottom: 1rem;
            }

            .actionButton {
              display: flex;
              flex-direction: row;
              justify-items: flex-end;
            }

            @media all and (min-width: 768px) {
              .questionPool {
                flex-flow: row wrap;

                padding: 2rem;
              }

              .tagList {
                flex: 0 0 auto;

                margin: 0;
                margin-right: 2rem;
              }

              .questionList {
                flex: 1;
              }
            }

            @media all and (min-width: 991px) {
              .questionPool {
                padding: 2rem 10% 2rem 2rem;
              }
            }
          `}
        </style>
      </TeacherLayout>
    )
  }
}

Index.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(CreateSessionMutation, {
    props: ({ mutate }) => ({
      createSession: ({ blocks, name }) =>
        mutate({
          refetchQueries: [{ query: SessionListQuery }],
          variables: { blocks, name },
        }),
    }),
  }),
  graphql(StartSessionMutation, {
    props: ({ mutate }) => ({
      startSession: ({ id }) =>
        mutate({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { id },
        }),
    }),
  }),
)(Index)
