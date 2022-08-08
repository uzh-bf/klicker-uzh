import { useMutation } from '@apollo/client'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import _get from 'lodash/get'
import Link from 'next/link'
import React, { useState } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Confirm, Dropdown, Icon, Label, Message } from 'semantic-ui-react'
import { twMerge } from 'tailwind-merge'

import { SESSION_STATUS } from '../../constants'
import DeleteSessionsMutation from '../../graphql/mutations/DeleteSessionsMutation.graphql'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'
import QuestionBlock from '../questions/QuestionBlock'

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
  storageModeComplete: {
    defaultMessage: 'COMPLETE',
    id: 'session.storageMode.complete',
  },
  storageModeSecret: {
    defaultMessage: 'AGGREGATED',
    id: 'session.storageMode.secret',
  },
  authModePassword: {
    defaultMessage: 'PASS',
    id: 'session.authMode.password',
  },
  authModeAAI: {
    defaultMessage: 'AAI',
    id: 'session.authMode.aai',
  },
})

interface Props {
  blocks?: any[]
  button: {
    disabled: boolean
    hidden?: boolean
    icon: 'copy' | 'play'
    message: React.ReactNode
    onClick: any
  }
  createdAt: string
  id: string
  name: string
  status: string
  isParticipantAuthenticationEnabled?: boolean
  authenticationMode?: 'PASSWORD' | 'AAI' | 'NONE'
  storageMode?: string
  confusionTS?: any[]
  feedbacks?: any[]
}

const defaultProps = {
  blocks: [],
  isParticipantAuthenticationEnabled: false,
  authenticationMode: 'NONE',
  storageMode: '',
  confusionTS: [],
  feedbacks: [],
}

function Session({
  button,
  createdAt,
  id,
  name,
  blocks,
  status,
  isParticipantAuthenticationEnabled,
  authenticationMode,
  storageMode,
  confusionTS,
  feedbacks,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [deletionConfirmation, setDeletionConfirmation] = useState(false)

  const [deleteSessions] = useMutation(DeleteSessionsMutation)

  const isFeedbackSession = blocks.length === 0

  return (
    <div className="flex flex-col flex-1 md:flex-row md:flex-wrap">
      <h2 className="text-xl md:flex-[0_0_50%] md:m-0 md:mb-[0.4rem] mb-[0.3rem] text-primary-strong">{name}</h2>

      <div className="flex flex-row mb-1 labels md:flex-[0_0_50%] md:m-0 md:mb-[0.4rem] justify-end">
        <Label
          className="md:!order-3 md:!w-[11rem] text-center"
          content={dayjs(createdAt).format('DD.MM.YY HH:mm')}
          icon="calendar"
          style={{ marginRight: '20px !important' }}
        />
        {isParticipantAuthenticationEnabled && [
          <Label
            className="md:order-2 min-w-[5.8rem] text-center"
            color="green"
            content="AUTH"
            icon="shield alternate"
            key="authMode"
          />,
          authenticationMode === 'PASSWORD' && (
            <Label
              className="md:order-1 min-w-[5.8rem] text-center"
              content={intl.formatMessage(messages.authModePassword)}
              icon="key"
            />
          ),
          authenticationMode === 'AAI' && (
            <Label
              className="md:order-1 min-w-[5.8rem] text-center"
              content={intl.formatMessage(messages.authModeAAI)}
              icon="key"
            />
          ),
          storageMode === 'SECRET' && (
            <Label
              className="md:order-1 min-w-[5.8rem] text-center"
              content={intl.formatMessage(messages.storageModeSecret)}
              icon="user secret"
            />
          ),
          storageMode === 'COMPLETE' && (
            <Label
              className="md:order-1 min-w-[5.8rem] text-center"
              content={intl.formatMessage(messages.storageModeComplete)}
              icon="archive"
            />
          ),
        ]}
      </div>

      <div className="flex flex-col flex-1 md:flex-row md:flex-wrap">
        {isFeedbackSession && (
          <div className="md:flex-1 md:m-0 md:mr-[0.4rem] mt-[0.3rem]">
            <Message info>
              <FormattedMessage
                defaultMessage="This feedback session does not contain any questions."
                id="runningSession.message.feedbackSession"
              />
            </Message>
          </div>
        )}

        {blocks.map(
          ({ id: blockId, instances, timeLimit }): React.ReactElement => (
            <div className="md:flex-1 md:m-0 md:mr-[0.4rem] mt-[0.3rem]" key={blockId}>
              <QuestionBlock
                noDetails
                questions={instances.map(({ id: instanceId, question, version, results }): any => ({
                  id: instanceId,
                  title: question.title,
                  totalParticipants: _get(results, 'totalParticipants') || 0,
                  type: question.type,
                  version,
                }))}
                timeLimit={timeLimit}
              />
            </div>
          )
        )}

        <div className="flex flex-col actionArea md:self-start md:w-[11rem] gap-2">
          <Dropdown button labeled className="icon left" icon="wrench" text="Options">
            <Dropdown.Menu>
              {status === SESSION_STATUS.CREATED && (
                <Link passHref href={{ pathname: '/questions', query: { editSessionId: id } }}>
                  <Dropdown.Item>
                    <Icon name="edit" />
                    <FormattedMessage defaultMessage="Modify Session" id="session.button.modify" />
                  </Dropdown.Item>
                </Link>
              )}

              <Link
                passHref
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

                  <>
                    <Dropdown.Item onClick={(): void => setDeletionConfirmation(true)}>
                      <Icon name="trash" />
                      <FormattedMessage defaultMessage="Delete Session" id="session.button.delete" />
                    </Dropdown.Item>
                    <Confirm
                      cancelButton={intl.formatMessage(messages.deletionConfirmationCancel)}
                      confirmButton={intl.formatMessage(messages.deletionConfirmationConfirm)}
                      content={intl.formatMessage(messages.deletionConfirmationContent, { name })}
                      open={deletionConfirmation}
                      onCancel={(): void => setDeletionConfirmation(false)}
                      onConfirm={async (): Promise<void> => {
                        try {
                          await deleteSessions({
                            optimisticResponse: {
                              __typename: 'Mutation',
                              deleteSessions: 'DELETION_SUCCESSFUL',
                            },
                            update: (cache, { data }): void => {
                              if (data.deleteSessions !== 'DELETION_SUCCESSFUL') {
                                return
                              }

                              const { sessions } = cache.readQuery({ query: SessionListQuery })
                              cache.writeQuery({
                                data: {
                                  sessions: sessions.filter((session): boolean => session.id !== id),
                                },
                                query: SessionListQuery,
                              })

                              setDeletionConfirmation(false)
                            },
                            variables: {
                              ids: [id],
                            },
                          })
                        } catch (e) {
                          console.error(e)
                        }

                        setDeletionConfirmation(false)
                      }}
                    />
                  </>
                </>
              )}
            </Dropdown.Menu>
          </Dropdown>

          {status !== SESSION_STATUS.CREATED && (
            <a
              className={twMerge(
                isFeedbackSession &&
                  confusionTS.length === 0 &&
                  feedbacks.length === 0 &&
                  'pointer-events-none cursor-default'
              )}
              href={`/sessions/evaluation/${id}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button
                className="justify-center w-full font-bold h-11"
                disabled={isFeedbackSession && confusionTS.length === 0 && feedbacks.length === 0}
              >
                <Button.Icon className="mr-1">
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>
                  <FormattedMessage defaultMessage="Evaluation" id="session.button.evaluation" />
                </Button.Label>
              </Button>
            </a>
          )}

          {button && !button.hidden && (
            <Button
              className="justify-center w-full font-bold h-11"
              disabled={button.disabled}
              onClick={button.onClick}
            >
              <Button.Icon className="mr-1">
                <FontAwesomeIcon icon={button.icon} />
              </Button.Icon>
              <Button.Label>{button.message}</Button.Label>
            </Button>
          )}
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .labels {
          :global(.label) {
            margin-right: 0.2rem !important;
          }
        }

        .actionArea {
          :global(.button),
          a :global(.button) {
            text-align: center;
            margin-right: 0 !important;
            width: 100%;
            margin-top: 0.3rem !important;
          }
        }

        @include desktop-tablet-only {
          .labels {
            :global(.label) {
              margin-right: 0 !important;
              margin-left: 0.4rem !important;
            }
          }

          .actionArea {
            :global(.button),
            a :global(.button) {
              margin-top: 0 !important;
              margin-bottom: 0.4rem !important;
            }

            :global(.button:last-child),
            a:last-child :global(.button) {
              margin-bottom: 0 !important;
            }
          }
        }
      `}</style>
    </div>
  )
}

Session.defaultProps = defaultProps

export default Session
