// @flow

import React from 'react'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'

import Placeholder from './Placeholder'
import Option from './Option'

type Props = {
  options: Array<{
    correct: boolean,
    name: string,
  }>,
  handleNewOption: ({
    correct: boolean,
    name: string,
  }) => void,
  handleDeleteOption: (index: number) => () => void,
  handleOptionToggleCorrect: (index: number) => () => void,
  handleUpdateOrder: (oldIndex: number, newIndex: number) => void,
}

const defaultProps = {
  options: [],
}

const Options = ({
  options,
  handleOptionToggleCorrect,
  handleDeleteOption,
  handleNewOption,
  handleUpdateOrder,
}: Props) => {
  const SortableOption = SortableElement(props => (
    <div className="option">
      <Option {...props} />
      <style jsx>{`
        .option {
          cursor: grab;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  ))

  const SortableOptions = SortableContainer(
    ({ sortableOptions, handleCorrectToggle, handleDelete }) => (
      <div className="options">
        {sortableOptions.map(({ correct, name }, index) => (
          <SortableOption
            key={`sortable-${name}`}
            index={index}
            name={name}
            correct={correct}
            handleCorrectToggle={handleCorrectToggle(index)}
            handleDelete={handleDelete(index)}
          />
        ))}
      </div>
    ),
  )

  return (
    <div>
      <SortableOptions
        sortableOptions={options}
        handleCorrectToggle={handleOptionToggleCorrect}
        handleDelete={handleDeleteOption}
        onSortEnd={handleUpdateOrder}
      />

      <Placeholder handleSave={handleNewOption} />
    </div>
  )
}

Options.defaultProps = defaultProps

export default Options
