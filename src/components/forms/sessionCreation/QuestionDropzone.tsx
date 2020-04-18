import React from 'react'
import classNames from 'classnames'
import { useDrop } from 'react-dnd'
import { Icon } from 'semantic-ui-react'

interface Props {
  onDrop: Function
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
      className={classNames('dropzone', { canDrop: collectedProps.canDrop, isOver: collectedProps.isOver })}
      ref={drop}
    >
      <Icon name="plus" />

      <style jsx>{`
        .dropzone {
          display: flex;
          align-items: center;
          justify-content: center;

          background-color: #efefef;
          border: 1px solid grey;
          border-style: dashed;
          color: grey;
          font-size: 1.5rem;
          height: 100%;
          width: 100%;
        }

        .dropzone.canDrop {
          border: 2px solid #6cbad8;
        }

        .dropzone.isOver {
          background-color: #6cbad8;
          color: #012f42;
        }
      `}</style>
    </div>
  )
}

export default QuestionDropzone
