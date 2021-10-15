import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Icon, Popup } from 'semantic-ui-react'

import { QUESTION_TYPES } from '../../constants'
import Button from '../common/Button'

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
  const PopupStyle = { opacity: 0.9 }

  return (
    <div className="required field typeChooser">
      <label htmlFor="types">
        <FormattedMessage defaultMessage="Question Type" id="createQuestion.questionType.label" />

        <Popup
          content={
            <FormattedMessage
              defaultMessage="Choose the type of question you would like to create."
              id="createQuestion.questionType.tooltip"
            />
          }
          trigger={
            <a data-tip>
              <Icon name="question circle" />
            </a>
          }
          position="right center"
          size="small"
          style={PopupStyle}
          mouseEnterDelay={250}
          mouseLeaveDelay={250}
          wide
          inverted
        />
      </label>

      <div className="types">
        {types.map(
          ({ name, value: typeValue }): React.ReactElement => (
            <Button
              active={typeValue === value}
              key={typeValue}
              type="button"
              onClick={(): void => onChange(typeValue)}
            >
              {name}
            </Button>
          )
        )}
      </div>

      <style jsx>
        {`
          @import 'src/theme';

          .typeChooser {
            @include tooltip-icon;

            .types {
              display: flex;
              flex-direction: column;

              > :global(*):not(:last-child) {
                margin-bottom: 0.5rem;
              }
            }
          }
        `}
      </style>
    </div>
  )
}

export default TypeChooser
