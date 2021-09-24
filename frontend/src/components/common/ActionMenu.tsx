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
    <div className="actionMenu">
      {expiresAt && (
        <div className="countdown">
          <Countdown
            circularDisplay
            isActive
            countdownDuration={timeLimit}
            countdownEnd={expiresAt}
            countdownStepSize={1000}
          />
        </div>
      )}
      <div className="progress">
        <Progress autoSuccess progress="ratio" total={numItems} value={activeIndex} />
      </div>
      <div className="actions">
        <Button fluid disabled={isSubmitDisabled} primary={!isSkipModeActive} onClick={onSubmit}>
          {isSkipModeActive ? (
            <FormattedMessage defaultMessage="Skip" id="common.button.skip" />
          ) : (
            <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
          )}
        </Button>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .actionMenu {
          align-items: center;
          border-top: 1px solid $color-primary-20p;
          display: flex;
          flex-direction: row;

          padding: 0.3rem;

          .countdown {
            flex: 0 0 3rem;
            padding-right: 0.5rem;
          }

          .progress {
            flex: 1;
            margin-right: 0.5rem;

            :global(.ui.progress) {
              margin: 0;
            }
          }

          .actions {
            flex: 0 0 7rem;

            :global(button.primary.button) {
              margin: 0;
            }
          }

          @include desktop-tablet-only {
            padding: 0.5rem 1rem;
          }
        }
      `}</style>
    </div>
  )
}

ActionMenu.defaultProps = defaultProps

export default ActionMenu
