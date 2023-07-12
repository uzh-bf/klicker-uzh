import { Button, Countdown, Progress } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
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
        className={{
          root: 'w-full h-10 my-auto bg-gray-100',
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
            root: '!mr-0 h-10 w-32 disabled:opacity-50 text-white font-bold bg-primary-80',
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
