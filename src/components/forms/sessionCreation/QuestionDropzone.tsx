import React from 'react'
import classNames from 'classnames'
import { useDrop } from 'react-dnd-cjs'
import { Icon } from 'semantic-ui-react'

function QuestionDropzone({ onDrop }): React.ReactElement {
  const [collectedProps, drop] = useDrop({
    accept: 'question',
    drop: item => onDrop(item),
    collect: monitor => ({
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

      <style jsx>
        {`
          .dropzone {
            display: flex;
            align-items: center;
            justify-content: center;

            background-color: #f2f2f2;
            border: 1px solid lightgrey;
            color: grey;
            font-size: 1.5rem;
            height: 100%;
            width: 100%;
          }

          .dropzone.canDrop {
            background-color: lightgrey;
            border-color: grey;
            color: grey;
          }

          .dropzone.isOver {
            border-color: blue;
          }
        `}
      </style>
    </div>
  )
}

export default QuestionDropzone
