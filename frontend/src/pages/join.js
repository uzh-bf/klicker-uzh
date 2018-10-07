import classNames from 'classnames'
import _debounce from 'lodash/debounce'
import { withRouter } from 'next/router'
import PropTypes from 'prop-types'
import React from 'react'
import { graphql } from 'react-apollo'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { branch, compose, renderComponent, withHandlers, withProps, withStateHandlers } from 'recompose'
import { StudentLayout } from '../components/layouts'
import FeedbackArea from '../components/sessions/join/FeedbackArea'
import QuestionArea from '../components/sessions/join/QuestionArea'
import { AddConfusionTSMutation, AddFeedbackMutation, AddResponseMutation, JoinSessionQuery } from '../graphql'
import { pageWithIntl, withFingerprint, withLogging, ensureFingerprint } from '../lib'

const messages = defineMessages({
  activeQuestionTitle: {
    defaultMessage: 'Active Question',
    id: 'joinSessionactiveQuestion.title',
  },
  feedbackChannelTitle: {
    defaultMessage: 'Feedback-Channel',
    id: 'joinSessionfeedbackChannel.title',
  },
})

const propTypes = {
  activeInstances: PropTypes.array,
  feedbacks: PropTypes.arrayOf({
    content: PropTypes.string.isRequired,
    votes: PropTypes.number.isRequired,
  }),
  handleNewConfusionTS: PropTypes.func.isRequired,
  handleNewFeedback: PropTypes.func.isRequired,
  handleNewResponse: PropTypes.func.isRequired,
  handleSidebarActiveItemChange: PropTypes.func.isRequired,
  handleToggleSidebarVisible: PropTypes.func.isRequired,
  id: PropTypes.string.isRequired,
  intl: intlShape.isRequired,
  isConfusionBarometerActive: PropTypes.bool.isRequired,
  isFeedbackChannelActive: PropTypes.bool.isRequired,
  shortname: PropTypes.string.isRequired,
  sidebarActiveItem: PropTypes.string.isRequired,
  sidebarVisible: PropTypes.bool.isRequired,
}

const defaultProps = {
  activeInstances: [],
  feedbacks: [],
}

const Join = ({
  activeInstances,
  id,
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
      ? intl.formatMessage(messages.activeQuestionTitle)
      : intl.formatMessage(messages.feedbackChannelTitle)

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
        {activeInstances.length > 0 ? (
          <QuestionArea
            active={sidebarActiveItem === 'activeQuestion'}
            handleNewResponse={handleNewResponse}
            questions={activeInstances}
            sessionId={id}
            shortname={shortname}
          />
        ) : (
          <div
            className={classNames('questionArea', {
              inactive: sidebarActiveItem !== 'activeQuestion',
            })}
          >
            <FormattedMessage defaultMessage="No question active." id="joinSession.noQuestionActive" />
          </div>
        )}

        {(isConfusionBarometerActive || isFeedbackChannelActive) && (
          <FeedbackArea
            active={sidebarActiveItem === 'feedbackChannel'}
            feedbacks={feedbacks}
            handleNewConfusionTS={handleNewConfusionTS}
            handleNewFeedback={handleNewFeedback}
            isConfusionBarometerActive={isConfusionBarometerActive}
            isFeedbackChannelActive={isFeedbackChannelActive}
            sessionId={id}
            shortname={shortname}
          />
        )}

        <style jsx>{`
          @import 'src/theme';

          .joinSession {
            display: flex;
            min-height: -moz-calc(100vh - 8rem);
            min-height: -webkit-calc(100vh - 8rem);
            min-height: calc(100vh - 8rem);
            width: 100%;

            background-color: lightgray;

            > * {
              flex: 0 0 50%;
            }

            .questionArea,
            .feedbackArea {
              padding: 1rem;

              &.inactive {
                display: none;
              }
            }

            @include desktop-tablet-only {
              padding: 1rem;
              min-height: 100%;

              .questionArea {
                border: 1px solid $color-primary;
                background-color: white;
                margin-right: 0.25rem;
              }

              .feedbackArea {
                border: 1px solid $color-primary;
                background-color: white;
                margin-left: 0.25rem;

                &.inactive {
                  display: block;
                }
              }
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
  withRouter,
  withLogging({
    logRocket: false,
  }),
  pageWithIntl,
  withFingerprint,
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
    }
  ),
  graphql(JoinSessionQuery, {
    options: ({ router }) => ({
      variables: { shortname: router.query.shortname },
    }),
  }),
  branch(({ data }) => data.loading, renderComponent(() => <div />)),
  branch(
    ({ data }) => data.errors || !data.joinSession,
    renderComponent(() => (
      <div>
        <FormattedMessage defaultMessage="No session active." id="joinSession.noSessionActive" />
      </div>
    ))
  ),
  graphql(AddConfusionTSMutation, { name: 'newConfusionTS' }),
  graphql(AddFeedbackMutation, { name: 'newFeedback' }),
  graphql(AddResponseMutation, { name: 'newResponse' }),
  withProps(({ data: { joinSession }, router, newConfusionTS }) => ({
    newConfusionTS: _debounce(newConfusionTS, 4000, { trailing: true }),
    ...joinSession,
    ...joinSession.settings,
    shortname: router.query.shortname,
  })),
  withHandlers({
    // handle creation of a new confusion timestep
    handleNewConfusionTS: ({ fp, data: { joinSession }, newConfusionTS }) => async ({ difficulty = 0, speed = 0 }) => {
      try {
        const fingerprint = await ensureFingerprint(fp)

        newConfusionTS({
          variables: {
            difficulty,
            fp: fingerprint,
            sessionId: joinSession.id,
            speed,
          },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle creation of a new feedback
    handleNewFeedback: ({ data: { joinSession }, fp, newFeedback, router }) => async ({ content }) => {
      if (!newFeedback) {
        return
      }

      try {
        const fingerprint = await ensureFingerprint(fp)

        if (joinSession.settings.isFeedbackChannelPublic) {
          newFeedback({
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
                variables: { shortname: router.query.shortname },
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
            variables: { content, fp: fingerprint, sessionId: joinSession.id },
          })
        } else {
          newFeedback({ variables: { content, fp: fingerprint, sessionId: joinSession.id } })
        }
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle creation of a new response
    handleNewResponse: ({ fp, newResponse }) => async ({ instanceId, response }) => {
      try {
        const fingerprint = await ensureFingerprint(fp)

        newResponse({
          variables: { fp: fingerprint, instanceId, response },
        })
      } catch ({ message }) {
        console.error(message)

        try {
          newResponse({
            variables: { instanceId, response },
          })
        } catch (e) {
          console.error(e)
        }
      }
    },

    handleSidebarActiveItemChange: ({ handleSidebarActiveItemChange }) => newItem => () => {
      // sessionStorage.setItem('sidebarActiveItem', newItem)
      handleSidebarActiveItemChange(newItem)
    },
  })
)(Join)
