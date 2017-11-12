import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import {
  compose,
  withHandlers,
  withStateHandlers,
  withProps,
  branch,
  renderComponent,
} from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'

import FeedbackArea from '../components/sessions/join/FeedbackArea'
import QuestionArea from '../components/sessions/join/QuestionArea'
import { pageWithIntl, withData } from '../lib'
import { JoinSessionQuery } from '../graphql/queries'
import {
  AddConfusionTSMutation,
  AddFeedbackMutation,
  AddResponseMutation,
} from '../graphql/mutations'
import { StudentLayout } from '../components/layouts'

const propTypes = {
  feedbacks: PropTypes.arrayOf({
    content: PropTypes.string.isRequired,
    votes: PropTypes.number.isRequired,
  }),
  handleSidebarActiveItemChange: PropTypes.func.isRequired,
  handleToggleSidebarVisible: PropTypes.func.isRequired,
  handleNewConfusionTS: PropTypes.func.isRequired,
  handleNewFeedback: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  sidebarActiveItem: PropTypes.string.isRequired,
  sidebarVisible: PropTypes.bool.isRequired,
}

const defaultProps = {
  feedbacks: [],
}

const Join = ({
  intl,
  feedbacks,
  activeQuestions,
  shortname,
  sidebarActiveItem,
  sidebarVisible,
  handleSidebarActiveItemChange,
  handleToggleSidebarVisible,
  handleNewConfusionTS,
  handleNewFeedback,
}) => {
  const title =
    sidebarActiveItem === 'activeQuestion'
      ? intl.formatMessage({
        defaultMessage: 'Active Question',
        id: 'student.activeQuestion.title',
      })
      : intl.formatMessage({
        defaultMessage: 'Feedback-Channel',
        id: 'student.feedbackChannel.title',
      })

  return (
    <StudentLayout
      pageTitle={`Join ${shortname}`}
      sidebar={{
        activeItem: sidebarActiveItem,
        handleSidebarActiveItemChange,
        handleToggleSidebarVisible,
        sidebarVisible,
      }}
      title={title}
    >
      <div className="joinSession">
        {activeQuestions.length > 0 ? (
          <QuestionArea
            active={sidebarActiveItem === 'activeQuestion'}
            questions={activeQuestions}
          />
        ) : (
          <div
            className={classNames('questionArea', {
              active: sidebarActiveItem === 'activeQuestion',
            })}
          >
            No evaluation active.
          </div>
        )}

        <FeedbackArea
          active={sidebarActiveItem === 'feedbackChannel'}
          feedbacks={feedbacks}
          handleNewConfusionTS={handleNewConfusionTS}
          handleNewFeedback={handleNewFeedback}
        />

        <style jsx>{`
          @import 'src/theme';

          .joinSession {
            display: flex;
            height: 100%;

            @include desktop-tablet-only {
              padding: 1rem;
            }
          }
        `}</style>
      </div>
    </StudentLayout>
  )
}

Join.propTypes = propTypes
Join.defaultProps = defaultProps

export default compose(
  withData,
  pageWithIntl,
  withStateHandlers(
    {
      sidebarActiveItem: 'activeQuestion',
      sidebarVisible: false,
    },
    {
      // handle a change in the active sidebar item
      handleSidebarActiveItemChange: () => sidebarActiveItem => ({
        sidebarActiveItem,
        sidebarVisible: false,
      }),
      // handle toggling the sidebar visibility
      handleToggleSidebarVisible: ({ sidebarVisible }) => () => ({
        sidebarVisible: !sidebarVisible,
      }),
    },
  ),
  withHandlers({
    handleSidebarActiveItemChange: ({ handleSidebarActiveItemChange }) => newItem => () =>
      handleSidebarActiveItemChange(newItem),
  }),
  graphql(JoinSessionQuery, {
    options: props => ({ variables: { shortname: props.url.query.shortname } }),
  }),
  branch(({ loading }) => loading, renderComponent(() => <div />)),
  branch(
    ({ data }) => data.errors || !data.joinSession,
    renderComponent(() => <div>No session active.</div>),
  ),
  graphql(AddConfusionTSMutation, { name: 'newConfusionTS' }),
  graphql(AddFeedbackMutation, { name: 'newFeedback' }),
  graphql(AddResponseMutation, { name: 'newResponse' }),
  withHandlers({
    handleNewConfusionTS: ({ data: { joinSession }, newConfusionTS }) => async ({
      difficulty,
      speed,
    }) => {
      try {
        await newConfusionTS({
          variables: { sessionId: joinSession.id, difficulty, speed },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
    handleNewFeedback: ({ data: { joinSession }, newFeedback, url }) => async ({ content }) => {
      try {
        if (joinSession.settings.isFeedbackChannelPublic) {
          await newFeedback({
            // optimistically add the feedback to the array already
            optimisticResponse: {
              addFeedback: {
                feedbacks: [
                  ...joinSession.feedbacks,
                  {
                    __typename: 'Feedback',
                    content,
                    // randomly generate an id, will be replaced by server response
                    id: Math.round(Math.random() * -1000000),
                    votes: 0,
                  },
                ],
              },
            },
            // update the cache after the mutation has completed
            update: (store, { data: { addFeedback } }) => {
              const query = {
                query: JoinSessionQuery,
                variables: { shortname: url.query.shortname },
              }

              // get the data from the store
              // replace the feedbacks
              const data = store.readQuery(query)
              data.joinSession.feedbacks = addFeedback.feedbacks

              // write the updated data to the store
              store.writeQuery({
                ...query,
                data,
              })
            },
            variables: { content, sessionId: joinSession.id },
          })
        } else {
          await newFeedback({ variables: { content, sessionId: joinSession.id } })
        }
      } catch ({ message }) {
        console.error(message)
      }
    },
    /* handleNewResponse: ({ data: { joinSession }, newResponse }) => async ({ response }) => {
      try {
        await newResponse({
          variables: { sessionId: joinSession.id,  },
        })
      } catch ({ message }) {
        console.error(message)
      }
    }, */
  }),
  withProps(({ data: { joinSession }, url }) => ({
    ...joinSession,
    shortname: url.query.shortname,
  })),
)(Join)
