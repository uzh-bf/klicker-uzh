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
    <div className="sticky top-0 z-10 -mx-4 mb-1.5 flex flex-row items-center gap-2 border-b border-slate-300 bg-white px-4 pb-2 pt-2 md:mx-0 md:mb-0 md:border-b-0 md:px-0">
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
          root: 'my-auto h-9 w-full rounded-md bg-gray-100',
          indicator: 'h-9 rounded-md',
          background: 'h-9 rounded-md',
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
              root: 'h-9 w-max px-5',
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
