import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _get from 'lodash/get'
import { Form, Button, Input } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { compose, withHandlers, mapProps } from 'recompose'

import { FREERestrictionTypes } from '../../../lib/constants'

const propTypes = {
  handleMaxChange: PropTypes.func.isRequired,
  handleMinChange: PropTypes.func.isRequired,
  handleTypeChange: PropTypes.func.isRequired,
  max: PropTypes.number,
  min: PropTypes.number,
  type: PropTypes.string.isRequired,
}

const defaultProps = {
  max: undefined,
  min: undefined,
}

const FREECreationOptions = ({
  max,
  min,
  type,
  handleMaxChange,
  handleMinChange,
  handleTypeChange,
}) => {
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
        {buttons.map(({ message, type: buttonType }) => (
          <Button
            key={buttonType}
            className={classNames('option', { active: buttonType === type })}
            type="button"
            onClick={handleTypeChange(buttonType)}
          >
            {message}
          </Button>
        ))}
      </div>

      {type === FREERestrictionTypes.RANGE && (
        <div className="range">
          <div className="rangeField">
            <label htmlFor="min">
              <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />
            </label>
            <Input name="min" type="number" value={min} onChange={handleMinChange} />
          </div>

          <div className="rangeField">
            <label htmlFor="max">
              <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />
            </label>
            <Input name="max" type="number" value={max} onChange={handleMaxChange} />
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
FREECreationOptions.defaultProps = defaultProps

export default compose(
  mapProps(({ input: { onChange, value } }) => ({
    max: _get(value, 'restrictions.max'),
    min: _get(value, 'restrictions.min'),
    onChange,
    type: _get(value, 'restrictions.type'),
    value,
  })),
  withHandlers({
    // handle a change in the maximum allowed numerical value
    handleMaxChange: ({ onChange, value }) => (e) => {
      const max = e.target.value === '' ? null : +e.target.value
      onChange({
        ...value,
        restrictions: { ...value.restrictions, max },
      })
    },

    // handle a change in the minimum allowed numerical value
    handleMinChange: ({ onChange, value }) => (e) => {
      const min = e.target.value === '' ? null : +e.target.value
      onChange({
        ...value,
        restrictions: { ...value.restrictions, min },
      })
    },

    // handle a change in the type of restriction for the answer format
    handleTypeChange: ({ onChange, value }) => type => () => {
      onChange({
        ...value,
        restrictions: { type },
      })
    },
  }),
)(FREECreationOptions)
