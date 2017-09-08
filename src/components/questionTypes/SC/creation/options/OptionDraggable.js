// @flow

import React from 'react'
import { Draggable } from 'react-beautiful-dnd'

type Props = {
  name: string,
  children: any,
}
const OptionDraggable = ({ name, children }: Props) => (
  <Draggable draggableId={name}>
    {(provided, snapshot) => (
      <div>
        <div
          ref={provided.innerRef}
          style={{
            backgroundColor: 'white',
            marginBottom: '0.5rem',
            userSelect: 'none',
            ...provided.draggableStyle,
          }}
          {...provided.dragHandleProps}
        >
          {children}
        </div>
        {provided.placeholder}
      </div>
    )}
  </Draggable>
)

export default OptionDraggable
