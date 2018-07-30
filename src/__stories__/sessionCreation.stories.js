import React from 'react'
import UUIDv4 from 'uuid/v4'
import { withStateHandlers } from 'recompose'
import { storiesOf } from '@storybook/react'
import { DragDropContext } from 'react-beautiful-dnd'
import { List, Map } from 'immutable'

import SessionCreation from '../components/forms/sessionCreation/SessionCreationForm'
import Question from '../components/questions/Question'
import { getIndex, moveQuestion, addToBlock, appendNewBlock } from '../lib/utils/move'

const withDnD = withStateHandlers(
  {
    blocks: List([
      { id: 'ba', questions: List([{ id: 'qa', title: 'bla', type: 'MC' }, { id: 'qb', title: 'blu', type: 'SC' }]) },
      { id: 'bb', questions: List([{ id: 'qc', title: 'bleb', type: 'MC' }]) },
      {
        id: 'bc',
        questions: List([
          { id: 'qd', title: 'bbeee', type: 'FREE' },
          { id: 'qe', title: 'biiiii', type: 'FREE_RANGE' },
        ]),
      },
    ]),
    name: 'hello',
  },
  {
    onDragEnd: ({ blocks }) => ({ source, destination }) => {
      if (!source || !destination) {
        return
      }

      // if the item was dropped in a new block
      if (destination.droppableId === 'new-block') {
        // generate a new uuid for the new block
        const blockId = UUIDv4()

        // initialize a new empty block at the end
        const extendedBlocks = blocks.push({ id: blockId, questions: List() })

        // perform the move between the source and the new block
        return {
          blocks: moveQuestion(extendedBlocks, source.droppableId, source.index, blockId, 0, true),
        }
      }

      return {
        blocks: moveQuestion(
          blocks,
          source.droppableId,
          source.index,
          destination.droppableId,
          destination.index,
          true
        ),
      }
    },
    onNewBlock: ({ blocks }) => question => appendNewBlock(blocks, question),
    onExtendBlock: ({ blocks }) => (blockId, question) => addToBlock(blocks, blockId, question),
  }
)

const DnDWrapper = withDnD(({ blocks, name, onDragEnd, onNewBlock, onExtendBlock }) => (
  <DragDropContext onDragEnd={onDragEnd}>
    <SessionCreation blocks={blocks} name={name} />
  </DragDropContext>
))

storiesOf('forms', module).add('SessionCreation', () => <DnDWrapper />)
