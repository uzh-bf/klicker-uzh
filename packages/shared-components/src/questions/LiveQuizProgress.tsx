import { Button, CycleCountdown, Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

export interface LiveQuizProgressProps {
  activeIndex: number
  contentInstance: boolean
  isSubmitDisabled?: boolean
  isSubmitHidden?: boolean
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  onSubmit: () => void
  onExpire: () => void
}

export function LiveQuizProgress({
  activeIndex,
  contentInstance,
  isSubmitDisabled = false,
  isSubmitHidden = false,
  numItems,
  expiresAt,
  timeLimit,
  onSubmit,
  onExpire,
}: LiveQuizProgressProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div className="mb-1 flex flex-row items-center gap-2">
      {expiresAt && timeLimit && (
        <div className="flex-initial">
          <CycleCountdown
            expiresAt={expiresAt}
            totalDuration={timeLimit}
            onExpire={onExpire}
            overrideSize={25}
          />
        </div>
      )}

      <Progress
        className={{
          root: 'my-auto h-10 w-full bg-gray-100',
          indicator: 'h-10',
        }}
        value={activeIndex}
        max={numItems}
        formatter={(val) =>
          (val as number) <= 0
            ? '0%'
            : `${(((val as number) / numItems) * 100) >> 0}%`
        }
        isMaxVisible={true}
      />

      {!isSubmitHidden && (
        <div className="my-auto">
          <Button
            fluid
            primary
            className={{
              root: 'h-10 w-32',
            }}
            disabled={isSubmitDisabled}
            onClick={onSubmit}
            data={{ cy: 'student-submit-answer' }}
          >
            <Button.Label>
              {contentInstance
                ? t('shared.generic.next')
                : t('shared.generic.send')}
            </Button.Label>
          </Button>
        </div>
      )}
    </div>
  )
}

export default LiveQuizProgress
