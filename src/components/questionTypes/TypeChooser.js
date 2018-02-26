import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage, intlShape } from 'react-intl'
import { Icon } from 'semantic-ui-react'

import { QUESTION_TYPES } from '../../constants'
import { Button } from '../common'

const propTypes = {
  intl: intlShape.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
}

const TypeChooser = ({ intl, value, onChange }) => {
  const types = [
    {
      name: intl.formatMessage({
        defaultMessage: 'SC',
        id: 'common.questionTypes.sc',
      }),
      value: QUESTION_TYPES.SC,
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'MC',
        id: 'common.questionTypes.mc',
      }),
      value: QUESTION_TYPES.MC,
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'FREE',
        id: 'common.questionTypes.free',
      }),
      value: QUESTION_TYPES.FREE,
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'FREE_RANGE',
        id: 'common.questionTypes.freeRange',
      }),
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
