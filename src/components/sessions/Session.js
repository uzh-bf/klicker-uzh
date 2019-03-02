import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import Link from 'next/link'
import _get from 'lodash/get'
import { withState } from 'recompose'
import { Mutation } from 'react-apollo'
import { Confirm, Button, Icon, Message, Dropdown } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'

import { SessionListQuery, DeleteSessionsMutation } from '../../graphql'
import { QuestionBlock } from '../questions'
import { SESSION_STATUS } from '../../constants'

const messages = defineMessages({
  deletionConfirmationCancel: {
    defaultMessage: 'Cancel',
    id: 'session.deletionConfirmation.cancel',
  },
  deletionConfirmationConfirm: {
    defaultMessage: 'Delete session!',
    id: 'session.deletionConfirmation.confirm',
  },
  deletionConfirmationContent: {
    defaultMessage: 'Are you sure you want to delete "{name}"? All results will be lost!',
    id: 'session.deletionConfirmation.content',
  },
})

const propTypes = {
  blocks: PropTypes.array,
  button: PropTypes.shape({
    disabled: PropTypes.bool.isRequired,
    icon: PropTypes.oneOf(['copy', 'play']).isRequired,
    message: PropTypes.element.isRequired,
    onClick: PropTypes.func.isRequired,
  }).isRequired,
  createdAt: PropTypes.string.isRequired,
  deletionConfirmation: PropTypes.bool.isRequired,
  handleSetDeletionConfirmation: PropTypes.func.isRequired,
  id: PropTypes.string.isRequired,
  intl: intlShape.isRequired,
  name: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
}

const defaultProps = {
  blocks: [],
}

const Session = ({
  intl,
  button,
  createdAt,
  deletionConfirmation,
  id,
  name,
  blocks,
  status,
  handleSetDeletionConfirmation,
}) => {
  const isFeedbackSession = blocks.length === 0

  return (
    <div className="session">
      <h2 className="title">{name}</h2>
      <div className="date">
        <FormattedMessage defaultMessage="Created on" id="sessionList.string.createdOn" />{' '}
        {dayjs(createdAt).format('DD.MM.YY HH:mm')}
      </div>

      <div className="details">
        {isFeedbackSession && (
          <div className="block">
            <Message info>
              <FormattedMessage
                defaultMessage="This feedback session does not contain any questions."
                id="runningSession.message.feedbackSession"
              />
            </Message>
          </div>
        )}
        {blocks.map(({ id: blockId, instances, showSolutions, timeLimit }) => (
          <div className="block" key={blockId}>
            <QuestionBlock
              noDetails
              questions={instances.map(({ id: instanceId, question, version, results }) => ({
                id: instanceId,
                title: question.title,
                totalParticipants: _get(results, 'totalParticipants') || 0,
                type: question.type,
                version,
              }))}
              showSolutions={showSolutions}
              timeLimit={timeLimit}
            />
          </div>
        ))}
        <div className="actionArea">
          <div className="settings">
            <Dropdown button labeled className="icon" icon="wrench" text="Options">
              <Dropdown.Menu>
                {status === SESSION_STATUS.CREATED && (
                  <Link href={{ pathname: '/questions', query: { editSessionId: id } }}>
                    <Dropdown.Item>
                      <Icon name="edit" />
                      <FormattedMessage defaultMessage="Modify Session" id="session.button.modify" />
                    </Dropdown.Item>
                  </Link>
                )}

                <Link
                  href={{
                    pathname: '/questions',
                    query: { copy: true, editSessionId: id },
                  }}
                >
                  <Dropdown.Item>
                    <Icon name="copy" />
                    <FormattedMessage defaultMessage="Copy & Modify" id="session.button.copyAndModify" />
                  </Dropdown.Item>
                </Link>

                {status !== SESSION_STATUS.RUNNING && (
                  <>
                    <Dropdown.Divider />
                    <Mutation mutation={DeleteSessionsMutation}>
                      {deleteSessions => (
                        <>
                          <Dropdown.Item
                            onClick={async () => {
                              handleSetDeletionConfirmation(true)
                            }}
                          >
                            <Icon name="trash" />
                            <FormattedMessage defaultMessage="Delete Session" id="session.button.delete" />
                          </Dropdown.Item>
                          <Confirm
                            cancelButton={intl.formatMessage(messages.deletionConfirmationCancel)}
                            confirmButton={intl.formatMessage(messages.deletionConfirmationConfirm)}
                            content={intl.formatMessage(messages.deletionConfirmationContent, { name })}
                            open={deletionConfirmation}
                            onCancel={() => handleSetDeletionConfirmation(false)}
                            onConfirm={async () => {
                              try {
                                await deleteSessions({
                                  optimisticResponse: {
                                    __typename: 'Mutation',
                                    deleteSessions: 'DELETION_SUCCESSFUL',
                                  },
                                  update: (cache, { data }) => {
                                    if (data.deleteSessions !== 'DELETION_SUCCESSFUL') {
                                      return
                                    }

                                    const { sessions } = cache.readQuery({ query: SessionListQuery })
                                    cache.writeQuery({
                                      data: {
                                        sessions: sessions.filter(session => session.id !== id),
                                      },
                                      query: SessionListQuery,
                                    })

                                    handleSetDeletionConfirmation(false)
                                  },
                                  variables: {
                                    ids: [id],
                                  },
                                })
                              } catch (e) {
                                console.error(e)
                              }

                              handleSetDeletionConfirmation(false)
                            }}
                          />
                        </>
                      )}
                    </Mutation>
                  </>
                )}
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {status !== SESSION_STATUS.CREATED && (
            <a href={`/sessions/evaluation/${id}`} rel="noopener noreferrer" target="_blank">
              <Button icon primary disabled={isFeedbackSession} labelPosition="left">
                <Icon name="external" />
                <FormattedMessage defaultMessage="Evaluation" id="session.button.evaluation" />
              </Button>
            </a>
          )}

          {button && !button.hidden && (
            <Button icon primary disabled={button.disabled} labelPosition="left" onClick={button.onClick}>
              <Icon name={button.icon} />
              {button.message}
            </Button>
          )}
        </div>
      </div>

      <style jsx>
        {`
          @import 'src/theme';

          .session,
          .details {
            display: flex;
            flex-direction: column;
            flex: 1;
          }

          .title {
            color: $color-primary-strong;
          }

          .title,
          .date {
            margin: auto;
            margin-bottom: 0.5rem;
          }

          .block {
            margin-bottom: 0.5rem;
          }

          .actionArea {
            display: flex;
            flex-direction: column;

            :global(.button),
            a :global(.button) {
              margin-right: 0 !important;
              width: 100%;
            }
            :global(.button:not(:first-child)),
            a:not(:first-child) :global(.button) {
              margin-top: 0.3rem !important;
            }
          }

          @include desktop-tablet-only {
            .session,
            .details {
              flex-flow: row wrap;
            }
            .title,
            .date {
              flex: 0 0 50%;
              margin: 0;
            }
            .title {
              font-size: 1.2rem;
              margin-bottom: 0.5rem;
            }
            .date {
              align-self: center;
              text-align: right;
            }
            .details {
              //border: 1px solid lightgrey;
            }
            .block {
              flex: 1;
              margin: 0;
              margin-right: 0.5rem;
            }
            .actionArea {
              align-self: flex-end;
            }
          }
        `}
      </style>
    </div>
  )
}

Session.propTypes = propTypes
Session.defaultProps = defaultProps

export default withState('deletionConfirmation', 'handleSetDeletionConfirmation', false)(Session)
