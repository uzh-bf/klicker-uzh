// @flow

import React from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import Option from './Option'
import OptionDraggable from './OptionDraggable'
import Placeholder from './Placeholder'

import { onDragEnd } from './utils'

type Props = {
  options: Array<*>,
  handleDeleteOption: (index: Number) => void,
  handleNewOption: (option: *) => void,
  handleOptionToggleCorrect: (index: Number) => void,
  handleUpdateOrder: (options: Array<*>) => void,
}
const OptionsDraggable = ({
  options,
  handleDeleteOption,
  handleNewOption,
  handleOptionToggleCorrect,
  handleUpdateOrder,
}: Props) => (
  <div>
    <DragDropContext onDragEnd={result => onDragEnd(options, result, handleUpdateOrder)}>
      <Droppable droppableId="droppable">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} style={{ backgroundColor: 'white' }}>
            {options.map(({ correct, name }, index) => (
              <OptionDraggable key={name} name={name}>
                <Option
                  correct={correct}
                  name={name}
                  handleCorrectToggle={handleOptionToggleCorrect(index)}
                  handleDelete={handleDeleteOption(index)}
                />
              </OptionDraggable>
            ))}
          </div>
        )}
      </Droppable>
    </DragDropContext>

    <Placeholder handleSave={handleNewOption} />
  </div>
)

export default OptionsDraggable
