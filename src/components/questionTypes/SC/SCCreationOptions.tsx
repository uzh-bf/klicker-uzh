import React from 'react'
import ReactTooltip from 'react-tooltip'
import { arrayMove, SortableContainer, SortableElement } from 'react-sortable-hoc'
import { FormattedMessage } from 'react-intl'
import { compose, mapProps, withHandlers } from 'recompose'
import { Form, Icon } from 'semantic-ui-react'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'

interface Props {
  dirty: boolean
  disabled: boolean
  handleDeleteOption: any
  handleNewOption: any
  handleOptionToggleCorrect: any
  handleSaveNewName: any
  handleUpdateOrder: any
  invalid: boolean
  value: any[]
}

function SCCreationOptions({
  disabled,
  handleNewOption,
  handleDeleteOption,
  handleUpdateOrder,
  handleOptionToggleCorrect,
  handleSaveNewName,
  value,
  dirty,
  invalid,
}: Props): React.ReactElement {
  const Option = props => (
    <div className="option">
      <SCCreationOption disabled={disabled} {...props} />
      <style jsx>
        {`
          .option {
            cursor: grab;
            margin-bottom: 0.5rem;
          }
          .option:hover {
            box-shadow: 0 0 0.2rem blue;
            -webkit-transition: all 0.1s;
            transition: all 0.1s;
          }
        `}
      </style>
    </div>
  )

  const SortableOption = disabled ? Option : SortableElement(Option)

  const Options = ({
    sortableOptions,
    handleCorrectToggle,
    handleDelete,
    handleSaveNewName: saveNewName,
  }): React.ReactElement => (
    <div className="options">
      {sortableOptions.map(
        ({ correct, name, editMode }, index): React.ReactElement => (
          <SortableOption
            correct={correct}
            editMode={editMode}
            handleCorrectToggle={handleCorrectToggle(index)}
            handleDelete={handleDelete(index)}
            handleSaveNewName={saveNewName(index)}
            index={index}
            key={`sortable-${name}`}
            name={name}
          />
        )
      )}
    </div>
  )

  const SortableOptions = disabled ? Options : SortableContainer(Options)

  return (
    <div className="SCCreationOptions">
      <Form.Field required error={dirty && invalid}>
        <label htmlFor="options">
          <FormattedMessage defaultMessage="Available Choices" id="createQuestion.optionsSC.label" />
          <a data-tip data-for="SCCreationHelp">
            <Icon name="question circle" />
          </a>
        </label>

        <ReactTooltip delayHide={250} delayShow={250} id="SCCreationHelp" place="right">
          <FormattedMessage
            defaultMessage="Add answering options the respondents can choose from."
            id="createQuestion.optionsSC.tooltip"
          />
        </ReactTooltip>

        <SortableOptions
          handleCorrectToggle={handleOptionToggleCorrect}
          handleDelete={handleDeleteOption}
          handleSaveNewName={handleSaveNewName}
          sortableOptions={value || []}
          onSortEnd={handleUpdateOrder}
        />

        {!disabled && <SCCreationPlaceholder handleSave={handleNewOption} handleSaveNewName={handleSaveNewName} />}
      </Form.Field>

      <style jsx>
        {`
          @import 'src/theme';
          .SCCreationOptions {
            @include tooltip-icon;
          }
        `}
      </style>
    </div>
  )
}

export default compose(
  mapProps(({ onChange, value, dirty, invalid, disabled, name }) => ({
    name,
    dirty,
    disabled,
    // HACK: mapping as a workaround for the value.choices problem
    invalid,
    onChange: choices => onChange({ ...value, choices }),
    value: value.choices,
  })),
  withHandlers({
    handleDeleteOption: ({ onChange, value }) => index => () =>
      onChange([...value.slice(0, index), ...value.slice(index + 1)]),

    handleNewOption: ({ onChange, value }) => newOption => onChange([...value, newOption]),

    handleOptionToggleCorrect: ({ onChange, value }) => index => () => {
      const option = value[index]
      onChange([...value.slice(0, index), { ...option, correct: !option.correct }, ...value.slice(index + 1)])
    },

    handleUpdateOrder: ({ onChange, value }) => ({ oldIndex, newIndex }) =>
      onChange(arrayMove(value, oldIndex, newIndex)),

    handleSaveNewName: ({ value }) => index => ({ newName }) => {
      const option = value[index]
      option.name = newName
    },
  })
)(SCCreationOptions)
