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
  onPrev,
  onNext,
  onSubmit,
  onExpire,
}: LiveQuizProgressProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-1.5 flex flex-row items-center justify-between gap-2 border-b border-slate-300 bg-white px-4 pb-2 pt-2 md:mx-0 md:mb-0 md:border-b-0 md:px-0">
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
          className={{ root: 'h-8 w-8 md:h-9 md:w-9' }}
          data={{ cy: 'lq-nav-prev' }}
        >
          <Button.Icon
            withoutLabel
            icon={faChevronLeft}
            className={{ root: 'h-3 w-3 md:h-4 md:w-4' }}
          />
        </Button>
        <div className="mx-1 md:mx-1.5">{`Question ${activeIndex + 1}/${numItems}`}</div>
        <Button
          onClick={onNext}
          disabled={activeIndex >= allowedMaxIndex}
          className={{ root: 'h-8 w-8 md:h-9 md:w-9' }}
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
        {(() => {
          const atEnd = activeIndex >= allowedMaxIndex
          const buttonLabel = isContent
            ? t('shared.generic.next')
            : isCurrentUnanswered
              ? t('shared.generic.send')
              : t('shared.generic.continue')

          const buttonDisabled = isContent
            ? atEnd
            : isCurrentUnanswered
              ? !canSubmit
              : atEnd

          const onPrimary = () => {
            if (isContent) {
              onSubmit()
              return
            }
            if (isCurrentUnanswered) {
              onSubmit()
            } else {
              onNext()
            }
          }

          return (
            <Button
              fluid
              primary={isCurrentUnanswered && !isContent}
              className={{ root: 'h-8 px-4 md:h-9 md:px-5' }}
              disabled={buttonDisabled}
              onClick={onPrimary}
              data={{
                cy: isCurrentUnanswered
                  ? 'student-submit-answer'
                  : 'student-continue',
              }}
            >
              <Button.Label>{buttonLabel}</Button.Label>
            </Button>
          )
        })()}
      </div>
    </div>
  )
}

export default LiveQuizProgress
