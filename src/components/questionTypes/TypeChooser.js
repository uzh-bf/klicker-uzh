import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Icon } from 'semantic-ui-react'

import { QUESTION_TYPES } from '../../constants'
import { Button } from '../common'

const messages = defineMessages({
  freeLabel: {
    defaultMessage: 'Free Text (FT)',
    id: 'common.FREE.label',
  },
  freeRangeLabel: {
    defaultMessage: 'Number Range (NR)',
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

const propTypes = {
  intl: intlShape.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
}

const TypeChooser = ({ intl, value, onChange }) => {
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

  const handleClick = newValue => () => onChange(newValue)

  return (
    <div className="required field typeChooser">
      <label htmlFor="types">
        <FormattedMessage defaultMessage="Question Type" id="createQuestion.questionType.label" />
        <a data-tip data-for="TypeChooserHelp">
          <Icon name="question circle" />
        </a>
      </label>

      <ReactTooltip delayHide={250} delayShow={250} id="TypeChooserHelp" place="right">
        <FormattedMessage
          defaultMessage="Choose the type of question you would like to create."
          id="createQuestion.questionType.tooltip"
        />
      </ReactTooltip>

      <div className="types">
        {types.map(({ name, value: typeValue }) => (
          <Button
            active={typeValue === value}
            key={typeValue}
            type="button"
            onClick={handleClick(typeValue)}
          >
            {name}
          </Button>
        ))}
      </div>

      <style jsx>{`
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
      `}</style>
    </div>
  )
}

TypeChooser.propTypes = propTypes

export default TypeChooser
