import React from 'react'
import classNames from 'classnames'

import QuestionSingle from './QuestionSingle'
import Countdown from '../common/Countdown'
import BlockActionsDropdown from './BlockActionsDropdown'
import SessionStatusIcon from './SessionStatusIcon'

interface Question {
  id: number
  title: string
  totalParticipants?: number
  type: string
  version: number
}

interface Props {
  expiresAt?: any
  index?: number
  noDetails?: boolean
  questions: Question[]
  status?: string
  timeLimit?: number
  questionBlockId?: string
  sessionId?: string
  handleResetQuestionBlock?: () => void
}

const defaultProps = {
  index: undefined,
  noDetails: false,
  noVersions: false,
  status: 'PLANNED',
  timeLimit: undefined,
}

function QuestionBlock({
  expiresAt,
  handleResetQuestionBlock,
  index,
  status,
  questions,
  timeLimit,
  noDetails,
  questionBlockId,
  sessionId,
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

      {!noDetails && timeLimit > -1 && (
        <div className="timeLimit">
          <Countdown
            countdownDuration={timeLimit}
            countdownEnd={expiresAt}
            countdownStepSize={1000}
            isActive={status === 'ACTIVE'}
            isCompleted={status === 'EXECUTED'}
          />
        </div>
      )}

      {!noDetails && (
        <div className="blockActions">
          <BlockActionsDropdown
            questionBlockId={questionBlockId}
            sessionId={sessionId}
            timeLimit={timeLimit}
            onResetQuestionBlock={handleResetQuestionBlock}
          />
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

          .timeLimit {
            text-align: center;
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
