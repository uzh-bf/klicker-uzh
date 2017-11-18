import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { SortableContainer, SortableElement, arrayMove } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'
import { compose, mapProps, withHandlers } from 'recompose'
import { FaQuestionCircle } from 'react-icons/lib/fa'
import { Form } from 'semantic-ui-react'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'

const propTypes = {
  handleDeleteOption: PropTypes.func.isRequired,
  handleNewOption: PropTypes.func.isRequired,
  handleOptionToggleCorrect: PropTypes.func.isRequired,
  handleUpdateOrder: PropTypes.func.isRequired,
  meta: PropTypes.shape({
    dirty: PropTypes.bool,
    invalid: PropTypes.bool,
  }).isRequired,
  value: PropTypes.arrayOf(PropTypes.shape(SCCreationOption.propTypes)).isRequired,
}

// create the purely functional component
const SCCreationOptions = ({
  handleNewOption,
  handleDeleteOption,
  handleUpdateOrder,
  handleOptionToggleCorrect,
  value,
  meta: { dirty, invalid },
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
            correct={correct}
            handleCorrectToggle={handleCorrectToggle(index)}
            handleDelete={handleDelete(index)}
            index={index}
            key={`sortable-${name}`}
            name={name}
          />
        ))}
      </div>
    ),
  )

  return (
    <div className="SCCreationOptions">
      <Form.Field required error={dirty && invalid}>
        <label htmlFor="options">
          <FormattedMessage
            defaultMessage="Available Choices"
            id="teacher.createQuestion.optionsSC.label"
          />
          <a data-tip data-for="SCCreationHelp">
            <FaQuestionCircle />
          </a>
        </label>

        <ReactTooltip delayHide={250} delayShow={250} id="SCCreationHelp" place="right">
          <FormattedMessage
            defaultMessage="Add answering options the respondents can choose from."
            id="teacher.createQuestion.optionsSC.tooltip"
          />
        </ReactTooltip>

        <SortableOptions
          handleCorrectToggle={handleOptionToggleCorrect}
          handleDelete={handleDeleteOption}
          onSortEnd={handleUpdateOrder}
          sortableOptions={value || []}
        />

        <SCCreationPlaceholder handleSave={handleNewOption} />
      </Form.Field>

      <style jsx>{`
        @import 'src/theme';
        .SCCreationOptions {
          @include tooltip-icon;
        }
      `}</style>
    </div>
  )
}

SCCreationOptions.propTypes = propTypes

export default compose(
  mapProps(({ input: { onChange, value }, meta }) => ({
    // HACK: mapping as a workaround for the value.choices problem
    meta,
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
