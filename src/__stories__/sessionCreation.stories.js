import React from 'react'
import { withStateHandlers } from 'recompose'
import { storiesOf } from '@storybook/react'
import { DragDropContext } from 'react-beautiful-dnd'

import SessionCreation from '../components/forms/sessionCreation/SessionCreationForm'

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)

  return result
}

const move = (source, destination, droppableSource, droppableDestination) => {
  const sourceClone = Array.from(source)
  const destClone = Array.from(destination)
  const [removed] = sourceClone.splice(droppableSource.index, 1)

  destClone.splice(droppableDestination.index, 0, removed)

  const result = {}
  result[droppableSource.droppableId] = sourceClone
  result[droppableDestination.droppableId] = destClone

  return result
}

const withDnD = withStateHandlers(
  {
    blocks: [
      { id: 'a', questions: [{ id: 'a', content: 'bla' }, { id: 'b', content: 'blu' }] },
      { id: 'b', questions: [{ id: 'c', content: 'bleb' }] },
      { id: 'c', questions: [{ id: 'd', content: 'bbeee' }, { id: 'e', content: 'biiiii' }] },
    ],
    name: 'hello',
  },
  {
    onDragEnd: ({ blocks }) => ({ source, destination }) => {
      console.log(result)

      if (!destination) {
        return
      }

      if (source.droppableId === destination.droppableId) {
        const newBlocks = Array.from(blocks)
      } else {
      }
      // if the move was within the same block
      /* if (result.source === result.destination) {
        const [removed] = result[result.findIndex(block => block.id === result.source].splice()

      // otherwise
      } else {
        console.log('haa')
      } */

      return { blocks: result }
    },
  },
)

const DnDWrapper = withDnD(({ blocks, name, onDragEnd }) => (
  <DragDropContext onDragEnd={onDragEnd}>
    <SessionCreation blocks={blocks} name={name} />
  </DragDropContext>
))

storiesOf('forms', module).add('SessionCreation', () => <DnDWrapper />)
