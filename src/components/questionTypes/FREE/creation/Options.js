import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { FormattedMessage, intlShape } from 'react-intl'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    // TODO: fill value with expected shape
    value: PropTypes.shape({}).isRequired,
  }).isRequired,
  intl: intlShape.isRequired,
}

class Options extends React.Component {
  handleMaxChange = (e) => {
    const { input: { value, onChange } } = this.props

    let newMax = e.target.value
    if (newMax === '') {
      newMax = null
    }

    onChange({
      ...value,
      restrictions: {
        ...value.restrictions,
        max: newMax,
      },
    })
  }

  handleMinChange = (e) => {
    const { input: { value, onChange } } = this.props

    let newMin = e.target.value
    if (newMin === '') {
      newMin = null
    }

    onChange({
      ...value,
      restrictions: {
        ...value.restrictions,
        min: newMin,
      },
    })
  }

  handleTypeChange = type => () => {
    const { input: { value, onChange } } = this.props

    onChange({
      ...value,
      restrictions: {
        ...value.restrictions,
        type,
      },
    })
  }

  render() {
    const { input: { value }, intl } = this.props

    // TODO: extract to FormattedMessage
    const optionsData = [
      {
        name: intl.formatMessage({
          defaultMessage: 'No Limitations',
          id: 'teacher.createQuestion.options.noLimitations',
        }),
        value: 'NONE',
      },
      {
        name: intl.formatMessage({
          defaultMessage: 'Number Range',
          id: 'teacher.createQuestion.options.numberRange',
        }),
        value: 'NUMBERS',
      },
    ]

    return (
      <div className="field">
        <label htmlFor="options">
          <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
        </label>
        <div className="optionsChooser">
          {optionsData.map(({ name, value: optionValue }) => (
            <button
              key={optionValue}
              className={classNames('option', { active: optionValue === value.restrictions.type })}
              onClick={this.handleTypeChange(optionValue)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
        {value.restrictions.type === 'NUMBERS' && (
          <div className="range">
            <div className="rangeField">
              <label htmlFor="min">
                <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />
              </label>
              <input
                max={value.restrictions.max}
                name="min"
                type="number"
                value={value.restrictions.min}
                onChange={this.handleMinChange}
              />
            </div>
            <div className="rangeField">
              <label htmlFor="max">
                <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />
              </label>
              <input
                min={value.restrictions.min}
                name="max"
                type="number"
                value={value.restrictions.max}
                onChange={this.handleMaxChange}
              />
            </div>
          </div>
        )}

        <style jsx>{`
          button {
            background-color: white;
            border: 1px solid lightgrey;
            cursor: pointer;
            padding: 1rem;
            outline: none;
          }

          button.active {
            border-color: orange;
          }

          button:not(:last-child) {
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
      </div>
    )
  }
}

Options.propTypes = propTypes

export default Options
