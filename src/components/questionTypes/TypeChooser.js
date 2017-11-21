import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage, intlShape } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

import { QuestionTypes } from '../../constants'
import { Button } from '../common'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  intl: intlShape.isRequired,
}

const TypeChooser = ({ intl, input: { value, onChange } }) => {
  const types = [
    {
      name: intl.formatMessage({
        defaultMessage: 'SC',
        id: 'common.questionTypes.sc',
      }),
      value: QuestionTypes.SC,
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'MC',
        id: 'common.questionTypes.mc',
      }),
      value: QuestionTypes.MC,
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'FREE',
        id: 'common.questionTypes.free',
      }),
      value: QuestionTypes.FREE,
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'FREE_RANGE',
        id: 'common.questionTypes.freeRange',
      }),
      value: QuestionTypes.FREE_RANGE,
    },
  ]

  const handleClick = newValue => () => onChange(newValue)

  return (
    <div className="required field typeChooser">
      <label htmlFor="types">
        <FormattedMessage
          defaultMessage="Question Type"
          id="teacher.createQuestion.questionType.label"
        />
        <a data-tip data-for="TypeChooserHelp">
          <FaQuestionCircle />
        </a>
      </label>

      <ReactTooltip delayHide={250} delayShow={250} id="TypeChooserHelp" place="right">
        <FormattedMessage
          defaultMessage="Choose the type of question you would like to create."
          id="teacher.createQuestion.questionType.tooltip"
        />
      </ReactTooltip>

      <div className="types">
        {types.map(({ name, value: typeValue }) => (
          <Button active={typeValue === value} key={typeValue} onClick={handleClick(typeValue)}>
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
