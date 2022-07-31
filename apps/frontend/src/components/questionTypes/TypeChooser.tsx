import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Icon } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'

import { QUESTION_TYPES } from '../../constants'
import CustomTooltip from '../common/CustomTooltip'

const messages = defineMessages({
  freeLabel: {
    defaultMessage: 'Free Text (FT)',
    id: 'common.FREE.label',
  },
  freeRangeLabel: {
    defaultMessage: 'Numerical (NR)',
    id: 'common.FREE_RANGE.label',
  },
  mcLabel: {
    defaultMessage: 'Multiple Choice (MC)',
    id: 'common.MC.label',
  },
  scLabel: {
    defaultMessage: 'Single Choice (SC)',
    id: 'common.SC.label',
  },
})

interface Props {
  // eslint-disable-next-line no-unused-vars
  onChange: (value: string) => void
  value: string
}

function TypeChooser({ value, onChange }: Props): React.ReactElement {
  const intl = useIntl()

  const types = [
    {
      name: intl.formatMessage(messages.scLabel),
      value: QUESTION_TYPES.SC,
    },
    {
      name: intl.formatMessage(messages.mcLabel),
      value: QUESTION_TYPES.MC,
    },
    {
      name: intl.formatMessage(messages.freeLabel),
      value: QUESTION_TYPES.FREE,
    },
    {
      name: intl.formatMessage(messages.freeRangeLabel),
      value: QUESTION_TYPES.FREE_RANGE,
    },
  ]

  return (
    <div className="required field typeChooser">
      <label htmlFor="types">
        <FormattedMessage defaultMessage="Question Type" id="createQuestion.questionType.label" />

        <CustomTooltip
          tooltip={
            <FormattedMessage
              defaultMessage="Choose the type of question you would like to create."
              id="createQuestion.questionType.tooltip"
            />
          }
          tooltipStyle={'text-sm md:text-base max-w-[45%] md:max-w-[70%]'}
          withArrow={false}
        >
          <Icon className="!ml-2" color="blue" name="question circle" />
        </CustomTooltip>
      </label>

      <div className="flex flex-col gap-2">
        {types.map(
          ({ name, value: typeValue }): React.ReactElement => (
            <Button
              active={typeValue === value}
              className="justify-center py-2 text-lg h-11"
              key={typeValue}
              onClick={(): void => onChange(typeValue)}
            >
              {name}
            </Button>
          )
        )}
      </div>
    </div>
  )
}

export default TypeChooser
