import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage, intlShape } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

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
        defaultMessage: 'Single-Choice',
        id: 'common.questionTypes.sc',
      }),
      value: 'SC',
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'Multiple-Choice',
        id: 'common.questionTypes.mc',
      }),
      value: 'MC',
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'Free-Form',
        id: 'common.questionTypes.free',
      }),
      value: 'FREE',
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

      <ReactTooltip id="TypeChooserHelp" delayShow={250} delayHide={250} place="right">
        <FormattedMessage
          defaultMessage="Choose the type of question you would like to create."
          id="teacher.createQuestion.questionType.tooltip"
        />
      </ReactTooltip>

      <div className="types">
        {types.map(({ name, value: typeValue }) => (
          <Button key={typeValue} active={typeValue === value} onClick={handleClick(typeValue)}>
            {name}
          </Button>
        ))}
      </div>

      <style jsx>{`
        @import 'src/_theme';

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
