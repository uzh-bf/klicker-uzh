import { Button, Countdown, Progress } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import React from 'react'

interface SessionProgressProps {
  activeIndex: number
  isSkipModeActive?: boolean
  isSubmitDisabled?: boolean
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  onSubmit: () => void
  onExpire: () => void
}

const defaultProps = {
  isSkipModeActive: true,
  isSubmitDisabled: false,
  expiresAt: undefined,
  timeLimit: undefined,
}

function SessionProgress({
  activeIndex,
  isSkipModeActive,
  isSubmitDisabled,
  numItems,
  expiresAt,
  timeLimit,
  onSubmit,
  onExpire,
}: SessionProgressProps): React.ReactElement {
  const untilExpiration = expiresAt
    ? dayjs(expiresAt).diff(dayjs(), 'second')
    : 1000

  return (
    <div className="flex flex-row gap-2 mb-1">
      {expiresAt && timeLimit && (
        <div className="flex-initial">
          <Countdown
            countdownDuration={
              untilExpiration > timeLimit ? timeLimit : untilExpiration
            }
            onExpire={onExpire}
          />
        </div>
      )}

      <Progress
        className="w-full h-10 my-auto bg-gray-100"
        indicatorClassName="h-[2.375rem]"
        value={activeIndex}
        max={numItems}
        formatter={(val) => (val <= 0 ? '0%' : `${(val / numItems) * 100}\%`)}
      />

      <div className="my-auto">
        <Button
          fluid
          className="!mr-0 h-10"
          disabled={isSubmitDisabled}
          onClick={onSubmit}
        >
          {isSkipModeActive ? (
            <Button.Label>Überspringen</Button.Label>
          ) : (
            <Button.Label>Absenden</Button.Label>
          )}
        </Button>
      </div>
    </div>
  )
}

SessionProgress.defaultProps = defaultProps

export default SessionProgress
