// @flow

import React from 'react'
import classNames from 'classnames'
import { FaPlus } from 'react-icons/lib/fa'
import { DropTarget } from 'react-dnd'

type Props = {
  canDrop: boolean,
  isOver: boolean,
  connectDropTarget: any,
}
const QuestionDropzone = ({ canDrop, isOver, connectDropTarget }: Props) =>
  connectDropTarget(
    <div className={classNames('dropzone', { canDrop, isOver })}>
      <FaPlus />

      <style jsx>{`
        .dropzone {
          display: flex;
          align-items: center;
          justify-content: center;

          background-color: #f2f2f2;
          border: 1px solid lightgrey;
          color: lightgrey;
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
      `}</style>
    </div>,
  )

// define the target for DnD
const target = {
  // define what should be done once an item is dropped
  // props are passed through from the instantiation of the dropzone component
  // monitor.getItem('question') receives the data from the dragged component
  drop(props, monitor) {
    props.onDrop(monitor.getItem('question'))
  },
}

// define what information the dropzone component should collect
// we want to know whether we are hovering with a dragged component
const collect = (connect, monitor) => ({
  canDrop: monitor.canDrop(),
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
})

// use the same unique id 'question' as defined with the source configuration
const withDnD = DropTarget('question', target, collect)

export default withDnD(QuestionDropzone)
