import React from 'react'
import { twMerge } from 'tailwind-merge'

import Countdown from '@uzh-bf/design-system'
// import BlockSettingsForm from '../forms/BlockSettingsForm'
import QuestionSingle from './QuestionSingle'
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
  // randomSelection?: number
  // handleResetQuestionBlock?: () => void
  // handleActivateQuestionBlock?: () => void
  // withQuestionBlockExperiments?: boolean
}

const defaultProps = {
  index: undefined,
  noDetails: false,
  noVersions: false,
  status: 'PLANNED',
  timeLimit: undefined,
  // randomSelection: undefined,
  // withQuestionBlockExperiments: false,
}
function QuestionBlock({
  expiresAt,
  // handleResetQuestionBlock,
  // handleActivateQuestionBlock,
  index,
  status,
  questions,
  timeLimit,
  // randomSelection,
  noDetails,
  questionBlockId,
  sessionId,
  // withQuestionBlockExperiments,
}: Props): React.ReactElement {
  return (
    <div
      className={twMerge(
        'p-4 flex flex-col gap-2 bg-gray-50 border border-solid border-gray-100',
        status === 'ACTIVE' && 'bg-green-100'
      )}
    >
      <div className="flex flex-row flex-wrap justify-between">
        <div className="flex flex-row gap-1">
          {!noDetails && (
            <div>
              <SessionStatusIcon status={status} />
            </div>
          )}

          {index >= 0 && (
            <div className="font-bold text-primary-strong">Block {index}</div>
          )}
        </div>

        <div className="flex flex-row gap-4">
          {!noDetails && timeLimit > -1 && (
            <div>
              <Countdown
                countdownDuration={timeLimit}
                countdownEnd={expiresAt}
                countdownStepSize={1000}
                isActive={status === 'ACTIVE'}
                isCompleted={status === 'EXECUTED'}
              />
            </div>
          )}

          {/* // TODO: readd random selection feature
          {!noDetails && randomSelection > 0 && (
            <div>
              <Icon name="puzzle piece" />
              {randomSelection}/{questions.length}
            </div>
          )} */}

          {/* // TODO: readd possibilities to act directly on a certain block
          {!noDetails && (
            <div>
              <Dropdown icon="settings">
                <Dropdown.Menu>
                  <Dropdown.Item
                    disabled={status === 'ACTIVE'}
                    icon="play"
                    text="Block aktivieren"
                    onClick={handleActivateQuestionBlock}
                  />
                  <Dropdown.Item
                    icon="undo"
                    text="Resultate des Blocks zurücksetzen"
                    onClick={handleResetQuestionBlock}
                  />

                  // TODO: readd block settings form
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
          )} */}
        </div>
      </div>

      <div className="flex flex-col gap-2">
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
    </div>
  )
}

QuestionBlock.defaultProps = defaultProps

export default QuestionBlock
