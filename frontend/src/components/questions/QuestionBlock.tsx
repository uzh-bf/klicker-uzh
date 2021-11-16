import React from 'react'
import clsx from 'clsx'
import { Dropdown } from 'semantic-ui-react'
import { defineMessages, useIntl } from 'react-intl'

import BlockSettingsForm from '../forms/BlockSettingsForm'
import QuestionSingle from './QuestionSingle'
import Countdown from '../common/Countdown'
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
  randomSelection?: number
  handleResetQuestionBlock?: () => void
  handleActivateQuestionBlock?: () => void
  withQuestionBlockExperiments?: boolean
}

const defaultProps = {
  index: undefined,
  noDetails: false,
  noVersions: false,
  status: 'PLANNED',
  timeLimit: undefined,
  randomSelection: undefined,
  withQuestionBlockExperiments: false,
}

const messages = defineMessages({
  activateBlock: {
    defaultMessage: 'Activate block',
    id: 'runningSession.blockActions.activateBlock',
  },
  resetBlockResults: {
    id: 'runningSession.blockActions.resetBlockResults',
    defaultMessage: 'Reset block results',
  },
})

function QuestionBlock({
  expiresAt,
  handleResetQuestionBlock,
  handleActivateQuestionBlock,
  index,
  status,
  questions,
  timeLimit,
  randomSelection,
  noDetails,
  questionBlockId,
  sessionId,
  withQuestionBlockExperiments,
}: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <div className={clsx('questionBlock', { active: status === 'ACTIVE' })}>
      {!noDetails && (
        <div className="sessionStatus">
          <SessionStatusIcon status={status} />
        </div>
      )}

      {index >= 0 && <div className="index text-primary-strong">Block {index}</div>}

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
          <Dropdown icon="settings">
            <Dropdown.Menu>
              <Dropdown.Item
                disabled={status === 'ACTIVE'}
                icon="play"
                text={intl.formatMessage(messages.activateBlock)}
                onClick={handleActivateQuestionBlock}
              />
              <Dropdown.Item
                icon="undo"
                text={intl.formatMessage(messages.resetBlockResults)}
                onClick={handleResetQuestionBlock}
              />

              <BlockSettingsForm
                disabled={status === 'ACTIVE'}
                initialRandomSelection={randomSelection}
                initialTimeLimit={timeLimit}
                questionBlockId={questionBlockId}
                sessionId={sessionId}
                withQuestionBlockExperiments={withQuestionBlockExperiments}
              />
            </Dropdown.Menu>
          </Dropdown>
        </div>
      )}

      <div className="questions">
        {questions.map(
          (question): React.ReactElement => (
            <QuestionSingle
              key={question.id}
              title={question.title}
              totalParticipants={question.totalParticipants}
              type={question.type}
              version={question.version}
            />
          )
        )}
      </div>

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
