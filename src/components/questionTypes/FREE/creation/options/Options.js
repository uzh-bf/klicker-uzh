// @flow

import React from 'react'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'

import type { FREEOptionsType, ReduxFormInputType } from '../../../../../types'

type Props = {
  intl: $IntlShape,
  input: ReduxFormInputType<FREEOptionsType>,
}

class Options extends React.Component {
  props: Props

  static defaultProps = {
    value: {
      restrictions: {
        max: null,
        min: null,
        type: 'NONE',
      },
    },
  }

  handleMaxChange = (e: SyntheticInputEvent) => {
    const { input: { value, onChange } } = this.props

    let newMax = e.target.value
    if (e.target.value === '') {
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

  handleMinChange = (e: SyntheticInputEvent) => {
    const { input: { value, onChange } } = this.props

    let newMin = e.target.value
    if (e.target.value === '') {
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

  handleTypeChange = (type: string) => () => {
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
    const { intl, input: { value } } = this.props

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

export default Options
