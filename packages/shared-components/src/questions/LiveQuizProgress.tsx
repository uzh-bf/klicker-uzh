import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { Button, CycleCountdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

export interface LiveQuizProgressProps {
  // index of the currently active instance (0-based)
  activeIndex: number
  // total number of instances in the block
  numItems: number
  expiresAt?: Date
  timeLimit?: number
  // navigation constraints
  allowedMaxIndex: number
  isCurrentUnanswered: boolean
  isContent: boolean
  isBlockOver: boolean // boolean to hide countdown during cooldown
  canSubmit: boolean
  submitting?: boolean
  // actions
  onPrev: () => void
  onNext: () => void
  onSubmit: () => void
  onExpire: () => void
}

export function LiveQuizProgress({
  activeIndex,
  numItems,
  expiresAt,
  timeLimit,
  allowedMaxIndex,
  isCurrentUnanswered,
  isBlockOver,
  isContent,
  canSubmit,
  submitting = false,
  onPrev,
  onNext,
  onSubmit,
  onExpire,
}: LiveQuizProgressProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div
      aria-busy={submitting}
      className="sticky top-0 z-10 -mx-4 mb-1.5 flex flex-row items-center justify-between gap-2 border-b border-slate-300 bg-white px-4 pb-2 pt-2 md:mx-0 md:mb-0 md:border-b-0 md:px-0"
    >
      <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
        {expiresAt && timeLimit && !isBlockOver ? (
          <div className="flex-initial">
            <CycleCountdown
              expiresAt={expiresAt}
              totalDuration={timeLimit}
              onExpire={onExpire}
              overrideSize={25}
            />
          </div>
        ) : null}

        <Button
          onClick={onPrev}
          disabled={activeIndex <= 0}
          aria-label={t('shared.table.previous')}
          className={{ root: 'h-11 w-11' }}
          data={{ cy: 'lq-nav-prev' }}
        >
          <Button.Icon
            withoutLabel
            icon={faChevronLeft}
            className={{ root: 'h-3 w-3 md:h-4 md:w-4' }}
          />
        </Button>
        <div className="mx-1 md:mx-1.5">{`${t('shared.generic.question')} ${activeIndex + 1}/${numItems}`}</div>
        <Button
          onClick={onNext}
          disabled={activeIndex >= allowedMaxIndex}
          aria-label={t('shared.table.next')}
          className={{ root: 'h-11 w-11' }}
          data={{ cy: 'lq-nav-next' }}
        >
          <Button.Icon
            withoutLabel
            icon={faChevronRight}
            className={{ root: 'h-3 w-3 md:h-4 md:w-4' }}
          />
        </Button>
      </div>

      <div className="my-auto">
        <Button
          fluid
          primary={isCurrentUnanswered}
          className={{ root: 'min-h-11 px-4 md:px-5' }}
          loading={submitting}
          disabled={
            isCurrentUnanswered ? !canSubmit : activeIndex >= allowedMaxIndex
          }
          onClick={() => {
            if (isCurrentUnanswered) {
              onSubmit()
            } else {
              onNext()
            }
          }}
          data={{
            cy: isCurrentUnanswered
              ? 'student-submit-answer'
              : 'student-continue',
          }}
        >
          <Button.Label>
            {submitting
              ? t('shared.comments.sending')
              : !isCurrentUnanswered
                ? t('shared.generic.continue')
                : isContent
                  ? t('shared.generic.next')
                  : t('shared.generic.send')}
          </Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default LiveQuizProgress
