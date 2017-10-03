// @flow

import React from 'react'
import moment from 'moment'
import { Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import QuestionBlock from '../questions/QuestionBlock'

import type { QuestionBlockType } from '../../types'

type Props = {
  blocks: QuestionBlockType[],
  createdAt: string,
  id: string,
  name: string,
  status: 'CREATED' | 'RUNNING' | 'COMPLETED',
}

// const Session = ({ createdAt, name, blocks, id, status }: Props) => {
const Session = ({ createdAt, name, blocks, id }: Props) => {
  const statusCases = {
    COMPLETED: {
      disabled: false,
      icon: 'copy',
      message: <FormattedMessage id="session.button.completed.content" defaultMessage="Copy" />,
    },
    CREATED: {
      disabled: false,
      icon: 'play',
      message: <FormattedMessage id="session.button.created.content" defaultMessage="Start" />,
    },
    RUNNING: {
      disabled: true,
      icon: 'play',
      message: <FormattedMessage id="session.button.running.content" defaultMessage="Running" />,
    },
  }
  const buttonStatus = statusCases.CREATED // statusCases[status]

  return (
    <div className="session">
      <h2 className="title">
        {id.slice(0, 7)} - {name}
      </h2>
      <div className="date">
        <FormattedMessage id="sessionHistory.string.createdOn" defaultMessage="Created on" />{' '}
        {moment(createdAt).format('DD.MM.YYYY HH:MM:SS')}
      </div>

      <div className="details">
        {blocks.map(block => (
          <div className="block">
            <QuestionBlock
              // TODO: key={...}
              questions={block.instances.map(instance => ({
                id: instance.id,
                title: instance.question.title,
                type: instance.question.type,
              }))}
              showSolutions={block.showSolutions}
              timeLimit={block.timeLimit}
            />
          </div>
        ))}
        <div className="actionArea">
          <Button icon disabled={buttonStatus.disabled} labelPosition="left">
            <Icon name={buttonStatus.icon} />
            {buttonStatus.message}
          </Button>
        </div>
      </div>

      <style jsx>{`
        .session,
        .details {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .title,
        .date {
          margin: auto;
          margin-bottom: 0.5rem;
        }
        .block {
          margin: 0 0.5rem;
          margin-bottom: 0.5rem;
        }
        .actionArea {
          margin: auto;
        }

        @media all and (min-width: 768px) {
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
            border: 1px solid lightgrey;
          }
          .block {
            flex: 1;
            margin: 0.3rem;
          }
          .actionArea {
            align-self: flex-end;
            margin: 0 0 0.3rem 0.3rem;
          }
        }
      `}</style>
    </div>
  )
}

export default Session
