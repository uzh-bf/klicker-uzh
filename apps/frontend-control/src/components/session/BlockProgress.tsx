import { ElementBlockStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface BlockProgressProps {
  blocks: { id: number; status: ElementBlockStatus }[]
}

// One 6px segment per block: closed = green, active = blue, scheduled = grey.
function BlockProgress({ blocks }: BlockProgressProps) {
  const t = useTranslations()
  const done = blocks.filter(
    (block) => block.status === ElementBlockStatus.Executed
  ).length

  return (
    <div
      role="img"
      aria-label={t('control.liveQuiz.blockProgress', {
        done,
        total: blocks.length,
      })}
      className="flex gap-1"
      data-cy="block-progress"
    >
      {blocks.map((block) => (
        <div
          key={block.id}
          className={twMerge(
            'bg-ctrl-border h-1.5 flex-1 rounded-sm',
            block.status === ElementBlockStatus.Executed && 'bg-ctrl-good',
            block.status === ElementBlockStatus.Active && 'bg-uzh-blue'
          )}
        />
      ))}
    </div>
  )
}

export default BlockProgress
