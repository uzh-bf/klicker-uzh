// @flow

import React from 'react'
import { arrayMove, SortableContainer, SortableElement } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'

import Placeholder from './Placeholder'
import Option from './Option'

import type { ArrayInputType, OptionType } from '../../../../../types'

type Props = {
  input: ArrayInputType<OptionType>,
}

class Options extends React.Component {
  props: Props

  static defaultProps = {
    input: {
      value: [],
    },
  }

  handleUpdateOrder = ({ oldIndex, newIndex }: { oldIndex: number, newIndex: number }) => {
    this.props.input.onChange(arrayMove(this.props.input.value, oldIndex, newIndex))
  }

  handleNewOption = (option: OptionType) => {
    this.props.input.onChange([...this.props.input.value, option])
  }

  handleDeleteOption = (index: number) => () => {
    this.props.input.onChange([
      ...this.props.input.value.slice(0, index),
      ...this.props.input.value.slice(index + 1),
    ])
  }

  handleOptionToggleCorrect = (index: number) => () => {
    const option = this.props.input.value[index]

    this.props.input.onChange([
      ...this.props.input.value.slice(0, index),
      { ...option, correct: !option.correct },
      ...this.props.input.value.slice(index + 1),
    ])
  }

  render() {
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

    const { input: { value } } = this.props

    return (
      <div className="field">
        <label htmlFor="options">
          <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
        </label>
        <SortableOptions
          sortableOptions={value || []}
          handleCorrectToggle={this.handleOptionToggleCorrect}
          handleDelete={this.handleDeleteOption}
          onSortEnd={this.handleUpdateOrder}
        />

        <Placeholder handleSave={this.handleNewOption} />
      </div>
    )
  }
}

export default Options
