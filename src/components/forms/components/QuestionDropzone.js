// @flow

import React from 'react'
import classNames from 'classnames'
import { FaPlus } from 'react-icons/lib/fa'
import { DropTarget } from 'react-dnd'

type Props = {
  isOver: boolean,
  connectDropTarget: any,
}
const QuestionDropzone = ({ isOver, connectDropTarget }: Props) =>
  connectDropTarget(
    <div className={classNames('dropzone', { isOver })}>
      <div className="icon">
        <FaPlus />
      </div>

      <style jsx>{`
        .dropzone {
          display: flex;
          align-items: center;
          justify-content: center;

          background-color: lightgrey;
          border: 1px solid grey;
          height: 100%;
          width: 100%;
        }

        .dropzone > .icon {
          color: grey;
          font-size: 1.5rem;
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
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
})

// use the same unique id 'question' as defined with the source configuration
const withDnD = DropTarget('question', target, collect)

export default withDnD(QuestionDropzone)
