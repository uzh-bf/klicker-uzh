import React from 'react'
import { Button, Progress } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import Countdown from './Countdown'

interface Props {
  activeIndex: number
  isSkipModeActive?: boolean
  isSubmitDisabled?: boolean
  numItems: number
  onSubmit: any
  expiresAt?: any
  timeLimit?: number
}

const defaultProps = {
  isSkipModeActive: true,
  isSubmitDisabled: false,
}

function ActionMenu({
  activeIndex,
  isSkipModeActive,
  isSubmitDisabled,
  numItems,
  expiresAt,
  onSubmit,
  timeLimit,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-row gap-2 border-t border-primary-20">
      {expiresAt && (
        <div className="flex-initial w-12">
          <Countdown
            circularDisplay
            isActive
            countdownDuration={timeLimit}
            countdownEnd={expiresAt}
            countdownStepSize={1000}
          />
        </div>
      )}
      <div className="flex-1">
        <Progress autoSuccess className="!m-0 !p-1" progress="ratio" total={numItems} value={activeIndex} />
      </div>
      <div className="flex-initial w-24 actions">
        <Button
          fluid
          basic={isSkipModeActive}
          className="!mr-0 h-full"
          disabled={isSubmitDisabled}
          primary={!isSkipModeActive}
          size="tiny"
          onClick={onSubmit}
        >
          {isSkipModeActive ? (
            <FormattedMessage defaultMessage="Skip" id="common.button.skip" />
          ) : (
            <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
          )}
        </Button>
      </div>
    </div>
  )
}

ActionMenu.defaultProps = defaultProps

export default ActionMenu
