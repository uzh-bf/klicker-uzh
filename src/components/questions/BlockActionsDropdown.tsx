import React from 'react'
import { Dropdown } from 'semantic-ui-react'

import BlockSettingsForm from '../forms/BlockSettingsForm'

interface Props {
  sessionId: string
  questionBlockId: string
  timeLimit?: number
  onResetQuestionBlock: () => void
}

function BlockActionsDropdown({
  sessionId,
  questionBlockId,
  timeLimit,
  onResetQuestionBlock,
}: Props): React.ReactElement {
  return (
    <Dropdown icon="settings">
      <Dropdown.Menu>
        <Dropdown.Item icon="redo" text="Reset block results" onClick={onResetQuestionBlock} />
        <BlockSettingsForm initialTimeLimit={timeLimit} questionBlockId={questionBlockId} sessionId={sessionId} />
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default BlockActionsDropdown
