import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Form, Icon } from 'semantic-ui-react'

import SCCreationPlaceholder from './SCCreationPlaceholder'
import SCCreationOption from './SCCreationOption'
import { updateArrayElement, deleteArrayElement, reorder } from '../../../lib/utils/move'
import CustomTooltip from '../../common/CustomTooltip'

interface Props {
  dirty?: boolean
  disabled: boolean
  onChange: any
  invalid?: boolean
  value: {
    choices: { correct: boolean; name: string }[]
  }
}

const defaultProps = {
  dirty: false,
  invalid: false,
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

          <CustomTooltip
            tooltip={
              <FormattedMessage
                defaultMessage="Add answering options the respondents can choose from. All fields include full support for markdown formatting and inline LaTeX formulas enclosed by two $-signs on each side."
                id="createQuestion.optionsSC.tooltip"
              />
            }
            tooltipStyle={'text-sm md:text-base max-w-[35%] md:max-w-[50%]'}
            withArrow={false}
          >
            <Icon className="!ml-2" color="blue" name="question circle" />
          </CustomTooltip>
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
                key={name}
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

SCCreationOptions.defaultProps = defaultProps
export default SCCreationOptions
