import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Progress } from 'semantic-ui-react'

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
  expiresAt: undefined,
  timeLimit: undefined,
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
    <div className="flex flex-row gap-2">
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
      <div className="flex-initial w-24">
        <Button fluid className="!mr-0 h-full" disabled={isSubmitDisabled} onClick={onSubmit}>
          {isSkipModeActive ? (
            <Button.Label>
              <FormattedMessage defaultMessage="Skip" id="common.button.skip" />
            </Button.Label>
          ) : (
            <Button.Label>
              <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
            </Button.Label>
          )}
        </Button>
      </div>
    </div>
  )
}

ActionMenu.defaultProps = defaultProps

export default ActionMenu
