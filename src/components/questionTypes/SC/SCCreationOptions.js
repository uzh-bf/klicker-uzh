import React from 'react'
import PropTypes from 'prop-types'
import { SortableContainer, SortableElement, arrayMove } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'
import { compose, mapProps, withHandlers } from 'recompose'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'

const propTypes = {
  handleDeleteOption: PropTypes.func.isRequired,
  handleNewOption: PropTypes.func.isRequired,
  handleOptionToggleCorrect: PropTypes.func.isRequired,
  handleUpdateOrder: PropTypes.func.isRequired,
  value: PropTypes.arrayOf(PropTypes.shape(SCCreationOption.propTypes)).isRequired,
}

// create the purely functional component
const SCCreationOptions = ({
  handleNewOption,
  handleDeleteOption,
  handleUpdateOrder,
  handleOptionToggleCorrect,
  value,
}) => {
  const SortableOption = SortableElement(props => (
    <div className="option">
      <SCCreationOption {...props} />
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

      <SCCreationPlaceholder handleSave={handleNewOption} />
    </div>
  )
}

SCCreationOptions.propTypes = propTypes

export default compose(
  mapProps(({ input: { onChange, value } }) => ({
    // HACK: mapping as a workaround for the value.choices problem
    onChange: choices => onChange({ ...value, choices }),
    value: value.choices,
  })),
  withHandlers({
    handleDeleteOption: ({ onChange, value }) => index => () =>
      onChange([...value.slice(0, index), ...value.slice(index + 1)]),

    handleNewOption: ({ onChange, value }) => newOption => onChange([...value, newOption]),

    handleOptionToggleCorrect: ({ onChange, value }) => index => () => {
      const option = value[index]
      onChange([
        ...value.slice(0, index),
        { ...option, correct: !option.correct },
        ...value.slice(index + 1),
      ])
    },

    handleUpdateOrder: ({ onChange, value }) => ({ oldIndex, newIndex }) =>
      onChange(arrayMove(value, oldIndex, newIndex)),
  }),
)(SCCreationOptions)
