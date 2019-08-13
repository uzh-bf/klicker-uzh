import React from 'react'
import ReactTooltip from 'react-tooltip'
import { DragDropContext, Droppable } from 'react-beautiful-dnd'
import { FormattedMessage } from 'react-intl'
import { Form, Icon } from 'semantic-ui-react'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'
import { updateArrayElement, handleDragEnd, deleteArrayElement } from '../../../lib/utils/move'

interface Props {
  dirty?: boolean
  disabled: boolean
  onChange: any
  invalid?: boolean
  value: {
    choices: { correct: boolean; name: string }[]
  }
}

function SCCreationOptions({ disabled, value, dirty, invalid, onChange }: Props): React.ReactElement {
  const { choices } = value

  const handleChange = (newChoices): void => onChange({ ...value, choices: newChoices })
  const onNewOption = (newOption): void => handleChange([...choices, newOption])
  const onToggleOptionCorrect = (index: number): Function => (): void => {
    const option = choices[index]
    handleChange(updateArrayElement(choices, index, { correct: !option.correct }))
  }
  const onSaveNewName = (index: number): Function => ({ newName }): void => {
    handleChange(updateArrayElement(choices, index, { name: newName }))
  }
  const onDeleteOption = (index: number): Function => (): void => handleChange(deleteArrayElement(choices, index))

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

        <div className="options">
          <DragDropContext onDragEnd={!disabled && handleDragEnd(choices, handleChange)}>
            <Droppable droppableId="creationOptions">
              {(provided): React.ReactElement => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {choices.map(
                    ({ correct, name }, index): React.ReactElement => (
                      <SCCreationOption
                        correct={correct}
                        disabled={disabled}
                        handleCorrectToggle={onToggleOptionCorrect(index)}
                        handleDelete={onDeleteOption(index)}
                        handleSaveNewName={onSaveNewName(index)}
                        index={index}
                        name={name}
                      />
                    )
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {!disabled && <SCCreationPlaceholder handleSave={onNewOption} />}
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

export default SCCreationOptions
