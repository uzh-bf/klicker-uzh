import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Form, Button } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'

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
    <Form.Field>
      <label htmlFor="types">
        <FormattedMessage defaultMessage="Question type" id="teacher.createQuestion.questionType" />
      </label>
      <div className="typeChooser">
        {types.map(({ name, value: typeValue }) => (
          <Button
            key={typeValue}
            className={classNames('type', { active: typeValue === value })}
            onClick={handleClick(typeValue)}
          >
            {name}
          </Button>
        ))}
      </div>

      <style jsx>{`
        .typeChooser {
          display: flex;
          flex-direction: column;
        }

        .typeChooser > :global(button) {
          border-radius: 0;
        }

        .typeChooser > :global(button:not(:last-child)) {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </Form.Field>
  )
}

TypeChooser.propTypes = propTypes

export default TypeChooser
