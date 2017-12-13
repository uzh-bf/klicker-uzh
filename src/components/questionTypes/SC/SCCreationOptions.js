import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { arrayMove, SortableContainer, SortableElement } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'
import { compose, mapProps, withHandlers } from 'recompose'
import { Form, Icon } from 'semantic-ui-react'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'

const propTypes = {
  disabled: PropTypes.bool.isRequired,
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
  disabled,
  handleNewOption,
  handleDeleteOption,
  handleUpdateOrder,
  handleOptionToggleCorrect,
  value,
  meta: { dirty, invalid },
}) => {
  const Option = props => (
    <div className="option">
      <SCCreationOption disabled={disabled} {...props} />
      <style jsx>{`
        .option {
          cursor: grab;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  )

  const SortableOption = disabled ? Option : SortableElement(Option)

  const Options = ({ sortableOptions, handleCorrectToggle, handleDelete }) => (
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
  )
  Options.propTypes = {
    handleCorrectToggle: PropTypes.func.isRequired,
    handleDelete: PropTypes.func.isRequired,
    sortableOptions: PropTypes.array.isRequired,
  }
  const SortableOptions = disabled ? Options : SortableContainer(Options)

  return (
    <div className="SCCreationOptions">
      <Form.Field required error={dirty && invalid}>
        <label htmlFor="options">
          <FormattedMessage
            defaultMessage="Available Choices"
            id="teacher.createQuestion.optionsSC.label"
          />
          <a data-tip data-for="SCCreationHelp">
            <Icon name="question circle" />
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
          sortableOptions={value || []}
          onSortEnd={handleUpdateOrder}
        />

        {!disabled && <SCCreationPlaceholder handleSave={handleNewOption} />}
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
  mapProps(({ input: { onChange, value }, meta, disabled }) => ({
    disabled,
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
