// @flow

import React from 'react'
import moment from 'moment'
import { FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

import QuestionBlock from '../questions/QuestionBlock'

type Props = {
  blocks: Array<{
    id: string,
    questions: Array<{
      id: string,
      questionDefinition: {
        title: string,
        type: string,
      },
    }>,
    showSolutions: boolean,
    timeLimit: number,
  }>,
  createdAt: string,
  id: string,
  name: string,
  status: 'CREATED' | 'RUNNING' | 'COMPLETED',
}

const defaultProps = {
  status: 'CREATED',
}

const Session = ({ createdAt, name, blocks, id, status }: Props) => {
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
  const buttonStatus = statusCases[status]

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
        {blocks.map(block =>
          (<div className="block">
            <QuestionBlock
              key={block.id}
              questions={block.questions.map(question => ({
                id: question.id,
                title: question.questionDefinition.title,
                type: question.questionDefinition.type,
              }))}
              showSolutions={block.showSolutions}
              timeLimit={block.timeLimit}
            />
          </div>),
        )}
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

Session.defaultProps = defaultProps

export default Session
