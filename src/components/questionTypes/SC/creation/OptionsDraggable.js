import React, { Component } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import Option from './Option'
import Placeholder from './Placeholder'

// a little function to help us with reordering the result
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)

  return result
}

// using some little inline style helpers to make the app look okay
const getItemStyle = (draggableStyle, isDragging) => ({
  userSelect: 'none',
  backgroundColor: 'white',
  // styles we need to apply on draggables
  ...draggableStyle,
})
const getListStyle = isDraggingOver => ({
  background: 'white',
})

class OptionsDraggable extends Component {
  state = {
    options: [],
  }

  handleSave = (newOption) => {
    this.setState({
      options: [...this.state.options, newOption],
    })
  }

  onDragEnd = (result) => {
    // dropped outside the list
    if (!result.destination) {
      return
    }

    const options = reorder(this.state.options, result.source.index, result.destination.index)

    this.setState({
      options,
    })
  }

  // Normally you would want to split things out into separate components.
  // But in this example everything is just done in one place for simplicity
  render() {
    return (
      <div>
        <DragDropContext onDragEnd={this.onDragEnd}>
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div ref={provided.innerRef} style={getListStyle(snapshot.isDraggingOver)}>
                {this.state.options.map(({ correct, name }) => (
                  <Draggable key={name} draggableId={name}>
                    {(provided, snapshot) => (
                      <div>
                        <div
                          ref={provided.innerRef}
                          style={getItemStyle(provided.draggableStyle, snapshot.isDragging)}
                          {...provided.dragHandleProps}
                        >
                          <Option correct={correct} name={name} />
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Draggable>
                ))}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <Placeholder handleSave={this.handleSave} />
      </div>
    )
  }
}

export default OptionsDraggable
