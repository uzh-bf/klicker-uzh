// @flow

import React from 'react'
import { arrayMove, SortableContainer, SortableElement } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'

import Placeholder from './Placeholder'
import Option from './Option'

import type { ReduxFormInputType, SCOptionsType, OptionType } from '../../../../../types'

type Props = {
  input: ReduxFormInputType<SCOptionsType>,
}

class Options extends React.Component {
  props: Props

  static defaultProps = {
    input: {
      value: {
        choices: [],
        randomized: false,
      },
    },
  }

  handleUpdateOrder = ({ oldIndex, newIndex }: { oldIndex: number, newIndex: number }) => {
    const { value, onChange } = this.props.input

    onChange({
      ...value,
      choices: arrayMove(value.choices, oldIndex, newIndex),
    })
  }

  handleNewOption = (option: OptionType) => {
    const { value, onChange } = this.props.input

    onChange({
      ...value,
      choices: [...value.choices, option],
    })
  }

  handleDeleteOption = (index: number) => () => {
    const { value, onChange } = this.props.input

    onChange({
      ...value,
      choices: [...value.choices.slice(0, index), ...value.choices.slice(index + 1)],
    })
  }

  handleOptionToggleCorrect = (index: number) => () => {
    const { value, onChange } = this.props.input
    const option = value.choices[index]

    onChange({
      ...value,
      choices: [
        ...value.choices.slice(0, index),
        { ...option, correct: !option.correct },
        ...value.choices.slice(index + 1),
      ],
    })
  }

  render() {
    const { input: { value } } = this.props

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
      ({ sortableOptions = [], handleCorrectToggle, handleDelete }) => (
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
      <div className="field">
        <label htmlFor="options">
          <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
        </label>
        <SortableOptions
          sortableOptions={value.choices}
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
