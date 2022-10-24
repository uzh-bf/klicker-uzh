import { Button, Countdown, Progress } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import React from 'react'

export interface SessionProgressProps {
  activeIndex: number
  isSubmitDisabled?: boolean
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  onSubmit: () => void
  onExpire: () => void
}

const defaultProps = {
  isSubmitDisabled: false,
  expiresAt: undefined,
  timeLimit: undefined,
}

export function SessionProgress({
  activeIndex,
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
        indicatorClassName="h-10"
        value={activeIndex}
        max={numItems}
        formatter={(val) =>
          val <= 0 ? '0%' : `${((val / numItems) * 100) >> 0}\%`
        }
        isMaxVisible={true}
      />

      <div className="my-auto">
        <Button
          fluid
          className={
            '!mr-0 h-10 w-32 disabled:opacity-50 bg-uzh-blue-80 text-white font-bold'
          }
          disabled={isSubmitDisabled}
          onClick={onSubmit}
        >
          <Button.Label>Absenden</Button.Label>
        </Button>
      </div>
    </div>
  )
}

SessionProgress.defaultProps = defaultProps

export default SessionProgress
