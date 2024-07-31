import { Button, CycleCountdown, Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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

export function SessionProgress({
  activeIndex,
  isSubmitDisabled = false,
  numItems,
  expiresAt,
  timeLimit,
  onSubmit,
  onExpire,
}: SessionProgressProps): React.ReactElement {
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
          val <= 0 ? '0%' : `${((val / numItems) * 100) >> 0}%`
        }
        isMaxVisible={true}
      />

      <div className="my-auto">
        <Button
          fluid
          className={{
            root: 'bg-primary-80 !mr-0 h-10 w-32 font-bold text-white disabled:opacity-50',
          }}
          disabled={isSubmitDisabled}
          onClick={onSubmit}
          data={{ cy: 'student-submit-answer' }}
        >
          <Button.Label>{t('shared.generic.send')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default SessionProgress
