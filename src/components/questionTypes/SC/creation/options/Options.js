/* eslint-disable react/prop-types */

import React from 'react'
import PropTypes from 'prop-types'
import { SortableContainer, SortableElement, arrayMove } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'
import { compose, withHandlers } from 'recompose'

import Placeholder from './Placeholder'
import Option from './Option'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.arrayOf(PropTypes.shape(Option.propTypes)).isRequired,
  }).isRequired,
}

// TODO: further recompose example
const enhance = compose(
  withHandlers({
    handleDeleteOption: ({ onChange, value }) => index =>
      onChange([...value.slice(0, index), ...value.slice(index + 1)]),
    handleNewOption: ({ input: { onChange, value } }) => option => onChange([...value, option]),
    handleOptionToggleCorrect: ({ onChange, value }) => index =>
      onChange([
        ...value.slice(0, index),
        { ...value[index], correct: !value[index].correct },
        ...value.slice(index),
      ]),
    handleUpdateOrder: ({ input: { onChange, value } }) => ({ oldIndex, newIndex }) =>
      onChange(arrayMove(value, oldIndex, newIndex)),
  }),
)

const Options = ({
  handleNewOption,
  handleDeleteOption,
  handleUpdateOrder,
  handleOptionToggleCorrect,
  value,
}) => {
  const SortableOption = SortableElement(props => (
    <div className="option">
      <Option {...props} />
      <style jsx>
        {`
          .option {
            cursor: grab;
            margin-bottom: 0.5rem;
          }
        `}
      </style>
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
    <div className="field">
      <label htmlFor="options">
        <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
      </label>
      <SortableOptions
        sortableOptions={value || []}
        handleCorrectToggle={handleOptionToggleCorrect}
        handleDelete={handleDeleteOption}
        onSortEnd={handleUpdateOrder}
      />

      <Placeholder handleSave={handleNewOption} />
    </div>
  )
}

const EnhancedOptions = enhance(Options)
EnhancedOptions.propTypes = propTypes

export default EnhancedOptions
