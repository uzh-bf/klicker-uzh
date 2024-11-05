import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ReactElement } from 'react'
import { ConnectableElement } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

function DropElementsStack({
  type,
  drop,
  isOver,
  index,
}: {
  type: 'block' | 'stack'
  drop: (
    elementOrNode: ConnectableElement,
    options?: any
  ) => ReactElement | null
  isOver: boolean
  index: number
}) {
  return drop(
    <div
      className={twMerge(
        'w-full rounded border border-solid p-0.5 text-center',
        isOver && 'bg-primary-20'
      )}
      data-cy={`drop-elements-${type}-${index}`}
    >
      <FontAwesomeIcon icon={faPlus} size="lg" />
    </div>
  )
}

export default DropElementsStack
