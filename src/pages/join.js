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
import { intlShape, FormattedMessage } from 'react-intl'
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
  activeQuestions: PropTypes.array,
  feedbacks: PropTypes.arrayOf({
    content: PropTypes.string.isRequired,
    votes: PropTypes.number.isRequired,
  }),
  handleNewConfusionTS: PropTypes.func.isRequired,
  handleNewFeedback: PropTypes.func.isRequired,
  handleNewResponse: PropTypes.func.isRequired,
  handleSidebarActiveItemChange: PropTypes.func.isRequired,
  handleToggleSidebarVisible: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isConfusionBarometerActive: PropTypes.bool.isRequired,
  isFeedbackChannelActive: PropTypes.bool.isRequired,
  shortname: PropTypes.string.isRequired,
  sidebarActiveItem: PropTypes.string.isRequired,
  sidebarVisible: PropTypes.bool.isRequired,
}

const defaultProps = {
  activeQuestions: [],
  feedbacks: [],
}

const Join = ({
  activeQuestions,
  intl,
  feedbacks,
  shortname,
  sidebarActiveItem,
  sidebarVisible,
  isFeedbackChannelActive,
  isConfusionBarometerActive,
  handleSidebarActiveItemChange,
  handleToggleSidebarVisible,
  handleNewConfusionTS,
  handleNewFeedback,
  handleNewResponse,
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
      isInteractionEnabled={isConfusionBarometerActive || isFeedbackChannelActive}
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
            handleNewResponse={handleNewResponse}
          />
        ) : (
          <div
            className={classNames('questionArea', {
              inactive: sidebarActiveItem !== 'activeQuestion',
            })}
          >
            <FormattedMessage
              defaultMessage="No evaluation active."
              id="joinSession.noEvaluationActive"
            />
          </div>
        )}

        <FeedbackArea
          active={sidebarActiveItem === 'feedbackChannel'}
          feedbacks={feedbacks}
          isConfusionBarometerActive={isConfusionBarometerActive}
          isFeedbackChannelActive={isFeedbackChannelActive}
          handleNewConfusionTS={handleNewConfusionTS}
          handleNewFeedback={handleNewFeedback}
        />

        <style jsx>{`
          @import 'src/theme';

          .joinSession {
            display: flex;
            height: 100%;

            background-color: lightgray;

            .questionArea {
              padding: 1rem;

              &.inactive {
                display: none;
              }
            }

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
    renderComponent(() => (
      <div>
        <FormattedMessage defaultMessage="No session active." id="joinSession.noSessionActive" />
      </div>
    )),
  ),
  graphql(AddConfusionTSMutation, { name: 'newConfusionTS' }),
  graphql(AddFeedbackMutation, { name: 'newFeedback' }),
  graphql(AddResponseMutation, { name: 'newResponse' }),
  withHandlers({
    // handle creation of a new confusion timestep
    handleNewConfusionTS: ({ data: { joinSession }, newConfusionTS }) => async ({
      difficulty,
      speed,
    }) => {
      try {
        await newConfusionTS({
          variables: { difficulty, sessionId: joinSession.id, speed },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle creation of a new feedback
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

    // handle creation of a new response
    handleNewResponse: ({ newResponse }) => async ({ instanceId, response }) => {
      try {
        await newResponse({
          variables: { instanceId, response },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
  withProps(({ data: { joinSession }, url }) => ({
    ...joinSession,
    ...joinSession.settings,
    shortname: url.query.shortname,
  })),
)(Join)
