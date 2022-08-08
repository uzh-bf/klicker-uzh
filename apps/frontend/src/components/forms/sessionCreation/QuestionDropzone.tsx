import React from 'react'
import { twMerge } from 'tailwind-merge'
import { useDrop } from 'react-dnd'
import { Icon } from 'semantic-ui-react'

interface Props {
  onDrop: any
}

function QuestionDropzone({ onDrop }: Props): React.ReactElement {
  const [collectedProps, drop] = useDrop({
    accept: 'question',
    drop: (item): void => onDrop(item),
    collect: (monitor): any => ({
      canDrop: monitor.canDrop(),
      isOver: monitor.isOver(),
    }),
  })

  return (
    <div
      className={twMerge(
        'dropzone flex items-center border border-dashed border-grey-100 bg-grey-20 justify-center text-2xl h-full w-full rounded',
        collectedProps.canDrop && '!border-2 !border-solid border-blue-300',
        collectedProps.isOver && '!bg-blue-300'
      )}
      ref={drop}
    >
      <Icon color="grey" name="plus" />
    </div>
  )
}

export default QuestionDropzone
