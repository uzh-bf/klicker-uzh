import * as Progress from '@radix-ui/react-progress'
import { Button, H4 } from '@uzh-bf/design-system'
import React, { useEffect, useState } from 'react'

import Countdown from './Countdown'

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
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    activeIndex === 0 ? setProgress(0) : setProgress(activeIndex / numItems)
  }, [activeIndex, numItems])

  return (
    <div className="flex flex-row gap-2">
      {expiresAt && timeLimit && (
        <div className="flex-initial">
          <Countdown
            countdownDuration={timeLimit}
            expiresAt={expiresAt}
            countdownStepSize={1000}
            onExpire={onExpire}
          />
        </div>
      )}

      <Progress.Root
        className="relative w-full h-10 my-auto overflow-hidden bg-white border border-solid rounded-md border-uzh-blue-80"
        value={activeIndex}
        max={numItems}
      >
        <div>
          <H4 className="absolute z-10 flex h-full ml-2 font-bold">
            <div className="self-center">
              {activeIndex}/{numItems}
            </div>
          </H4>
          <Progress.Indicator
            className="absolute z-0 w-full h-full transition-transform bg-green-400"
            style={{ transform: `translateX(-${100 - progress}%)` }}
          ></Progress.Indicator>
        </div>
      </Progress.Root>
      <div className="my-auto">
        <Button
          fluid
          className="!mr-0 h-10 border border-solid border-uzh-blue-80"
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
