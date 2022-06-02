import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Form, Icon } from 'semantic-ui-react'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'
import { updateArrayElement, deleteArrayElement, reorder } from '../../../lib/utils/move'
import SemanticCustomTooltip from '../../common/SemanticCustomTooltip'

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
  const onToggleOptionCorrect =
    (index: number): any =>
    (): void => {
      const option = choices[index]
      handleChange(updateArrayElement(choices, index, { correct: !option.correct }))
    }
  const onSaveNewName =
    (index: number): any =>
    ({ newName }): void => {
      handleChange(updateArrayElement(choices, index, { name: newName }))
    }
  const onDeleteOption =
    (index: number): any =>
    (): void =>
      handleChange(deleteArrayElement(choices, index))
  const onMoveUp =
    (index: number): any =>
    (): void =>
      handleChange(reorder(choices, index, index - 1))
  const onMoveDown =
    (index: number): any =>
    (): void =>
      handleChange(reorder(choices, index, index + 1))

  return (
    <div className="SCCreationOptions">
      <Form.Field required error={dirty && invalid}>
        <label htmlFor="options">
          <FormattedMessage defaultMessage="Available Choices" id="createQuestion.optionsSC.label" />

          <SemanticCustomTooltip
            className={'!ml-2'}
            content={
              <FormattedMessage
                defaultMessage="Add answering options the respondents can choose from. All fields include full support for markdown formatting and inline LaTeX formulas enclosed by two $-signs on each side."
                id="createQuestion.optionsSC.tooltip"
              />
            }
            trigger={
              <a data-tip>
                <Icon name="question circle" />
              </a>
            }
          />
        </label>

        <div className="options">
          {choices.map(
            ({ correct, name }, index): React.ReactElement => (
              <SCCreationOption
                correct={correct}
                disabled={disabled}
                handleCorrectToggle={onToggleOptionCorrect(index)}
                handleDelete={onDeleteOption(index)}
                handleMoveDown={onMoveDown(index)}
                handleMoveUp={onMoveUp(index)}
                handleSaveNewName={onSaveNewName(index)}
                index={index}
                key={index}
                name={name}
              />
            )
          )}
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
