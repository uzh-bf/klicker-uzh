import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3 } from '@uzh-bf/design-system'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import DynamicMarkdown from '../evaluation/DynamicMarkdown'

// Building blocks of the student practice quiz overview. The standard and the
// adaptive practice quiz both compose their start screen from these, so a
// change here reaches both.

/** The card around a practice quiz: bordered on wider screens unless embedded. */
export function PracticeQuizCard({
  embedded,
  focusedEmbed = false,
  className,
  children,
}: {
  embedded: boolean
  focusedEmbed?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className="flex-1">
      <div
        className={twMerge(
          focusedEmbed
            ? 'w-full space-y-3 px-1 pt-2 pb-20 sm:px-2'
            : 'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:p-8 md:pt-6',
          !embedded && 'md:border',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function PracticeQuizOverviewHeader({
  displayName,
  description,
}: {
  displayName: string
  description?: string | null
}) {
  return (
    <>
      <div className="border-b">
        <H3 className={{ root: 'mb-0' }}>{displayName}</H3>
      </div>

      {!description?.match(/^(<br>(\n)*)$/g) && description !== '' ? (
        <DynamicMarkdown content={description ?? undefined} />
      ) : null}
    </>
  )
}

/** Fact rows in up to two columns, side by side on wider screens. */
export function PracticeQuizOverviewFacts({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 text-sm md:flex-row md:gap-16">
      {children}
    </div>
  )
}

export function PracticeQuizOverviewFactColumn({
  children,
}: {
  children: ReactNode
}) {
  return <div className="flex-1 space-y-2">{children}</div>
}

export function PracticeQuizOverviewFact({
  icon,
  children,
  cy,
}: {
  icon: IconDefinition
  children: ReactNode
  cy?: string
}) {
  return (
    <div className="flex flex-row items-center gap-2" data-cy={cy}>
      <FontAwesomeIcon icon={icon} />
      {children}
    </div>
  )
}

export function PracticeQuizStartButton({
  label,
  onClick,
  cy,
  disabled,
  loading,
}: {
  label: string
  onClick: () => void
  cy: string
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <Button
      primary
      className={{ root: 'h-9 self-end text-lg' }}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      data={{ cy }}
    >
      <Button.Label>{label}</Button.Label>
    </Button>
  )
}
