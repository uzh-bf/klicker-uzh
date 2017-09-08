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
  handleDeleteOption: number => () => void,
  handleOptionToggleCorrect: number => () => void,
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
  const SortableOption = SortableElement(Option)
  const SortableOptions = SortableContainer(({ options, ...props }) => (
    <div>
      {options.map(({ correct, name }, index) => (
        <SortableOption key={`sortable-${name}`} index={index} name={name} correct={correct} {...props} />
      ))}
    </div>
  ))


  return (
    <div className="options">
      <SortableOptions
        options={options}
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
