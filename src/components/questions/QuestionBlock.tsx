import React from 'react'
import classNames from 'classnames'
import { Icon, Dropdown } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

interface Question {
  id: number
  title: string
  totalParticipants?: number
  type: string
  version: number
}

interface Props {
  index?: number
  noDetails?: boolean
  questions: Question[]
  status?: string
  timeLimit?: number
  handleResetQuestionBlock?: () => void
}

const defaultProps = {
  index: undefined,
  noDetails: false,
  noVersions: false,
  status: 'PLANNED',
  timeLimit: undefined,
}

function SessionStatusIcon({ status }: { status: string }): React.ReactElement {
  if (status === 'EXECUTED') {
    return <Icon name="checkmark" />
  }

  if (status === 'ACTIVE') {
    return <Icon name="comments outline" />
  }

  return <Icon name="calendar outline" />
}

function BlockActionsDropdown({ onResetQuestionBlock }: { onResetQuestionBlock: () => void }): React.ReactElement {
  return (
    <Dropdown icon="settings">
      <Dropdown.Menu>
        <Dropdown.Item icon="redo" text="Reset block results" onClick={onResetQuestionBlock} />
      </Dropdown.Menu>
    </Dropdown>
  )
}

function QuestionBlock({
  handleResetQuestionBlock,
  index,
  status,
  questions,
  timeLimit,
  noDetails,
}: Props): React.ReactElement {
  const questionElements = questions.map(
    (question): React.ReactElement => (
      <QuestionSingle
        key={question.id}
        title={question.title}
        totalParticipants={question.totalParticipants}
        type={question.type}
        version={question.version}
      />
    )
  )

  return (
    <div className={classNames('questionBlock', { active: status === 'ACTIVE' })}>
      {!noDetails && (
        <div className="sessionStatus">
          <SessionStatusIcon status={status} />
        </div>
      )}

      {index >= 0 && <div className="index">Block {index}</div>}

      {!noDetails && timeLimit && (
        <div className="timeLimit">
          <Icon name="clock" />
          {timeLimit}s
        </div>
      )}

      {!noDetails && (
        <div className="blockActions">
          <BlockActionsDropdown onResetQuestionBlock={handleResetQuestionBlock} />
        </div>
      )}

      <div className="questions">{questionElements}</div>

      <style jsx>{`
        @import 'src/theme';

        .questionBlock {
          display: flex;

          background-color: #eaeaea;
          border: 2px solid #c5c5c5;
          flex-flow: row wrap;
          padding: 0.4rem;

          &.active {
            border: 2px solid rgb(0, 97, 0);
            background-color: rgb(198, 293, 206);
          }

          .sessionStatus {
            flex: 0 0 auto;
            font-size: 1.1rem;
            text-align: left;

            > :global(icon) {
              margin: 0;
            }
          }

          .index {
            flex: 0 0 auto;
            color: $color-primary-strong;
            font-weight: bold;
          }

          .timeLimit,
          .showSolution,
          .blockActions {
            flex: 1 1 auto;
            margin-bottom: 0.2rem;
          }

          .blockActions {
            text-align: right;
          }

          .showSolution {
            text-align: center;
          }

          .questions {
            flex: 0 0 100%;
            height: 100%;
            background-color: white;

            > :global(*) {
              border: 1px solid grey;

              &:not(:first-child) {
                margin-top: 0.2rem;
              }
            }
          }
        }
      `}</style>
    </div>
  )
}

QuestionBlock.defaultProps = defaultProps

export default QuestionBlock
