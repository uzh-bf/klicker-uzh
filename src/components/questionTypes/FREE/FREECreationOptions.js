import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Form, Button, Input } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { compose, withHandlers, setPropTypes } from 'recompose'

import { FREERestrictionTypes } from '../../../lib/constants'

const propTypes = {
  handleMaxChange: PropTypes.func.isRequired,
  handleMinChange: PropTypes.func.isRequired,
  handleTypeChange: PropTypes.func.isRequired,
  input: PropTypes.shape({
    value: PropTypes.object,
  }).isRequired,
}

const FREECreationOptions = ({
  input: { value },
  handleMaxChange,
  handleMinChange,
  handleTypeChange,
}) => {
  const activeType = value.restrictions ? value.restrictions.type : FREERestrictionTypes.NONE

  const buttons = [
    {
      message: (
        <FormattedMessage
          defaultMessage="No Limitations"
          id="teacher.createQuestion.options.noLimitations"
        />
      ),
      type: FREERestrictionTypes.NONE,
    },
    {
      message: (
        <FormattedMessage
          defaultMessage="Number Range"
          id="teacher.createQuestion.options.numberRange"
        />
      ),
      type: FREERestrictionTypes.RANGE,
    },
  ]

  return (
    <Form.Field>
      <label htmlFor="options">
        <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
      </label>

      <div className="optionsChooser">
        {buttons.map(({ message, type }) => (
          <Button
            key={type}
            className={classNames('option', { active: type === activeType })}
            onClick={handleTypeChange(type)}
          >
            {message}
          </Button>
        ))}
      </div>

      {activeType === FREERestrictionTypes.RANGE && (
        <div className="range">
          <div className="rangeField">
            <label htmlFor="min">
              <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />
            </label>
            <Input
              name="min"
              type="number"
              value={value.restrictions.min}
              onChange={handleMinChange}
            />
          </div>

          <div className="rangeField">
            <label htmlFor="max">
              <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />
            </label>
            <Input
              name="max"
              type="number"
              value={value.restrictions.max}
              onChange={handleMaxChange}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .optionsChooser > :global(button:not(:last-child)) {
          margin-right: 1rem;
        }

        .range {
          margin-top: 0.5rem;
          display: flex;
        }

        .rangeField {
          width: 50%;
        }
      `}</style>
    </Form.Field>
  )
}

FREECreationOptions.propTypes = propTypes

export default compose(
  withHandlers({
    // handle a change in the maximum allowed numerical value
    handleMaxChange: ({ input: { onChange, value } }) => (e) => {
      const max = e.target.value === '' ? null : e.target.value
      onChange({
        ...value,
        restrictions: { ...value.restrictions, max },
      })
    },

    // handle a change in the minimum allowed numerical value
    handleMinChange: ({ input: { onChange, value } }) => (e) => {
      const min = e.target.value === '' ? null : e.target.value
      onChange({
        ...value,
        restrictions: { ...value.restrictions, min },
      })
    },

    // handle a change in the type of restriction for the answer format
    handleTypeChange: ({ input: { onChange, value } }) => type => () => {
      onChange({
        ...value,
        restrictions: { type },
      })
    },
  }),
  setPropTypes({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.object.isRequired,
  }),
)(FREECreationOptions)
