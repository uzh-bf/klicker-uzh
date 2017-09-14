// @flow

import React from 'react'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'

import type { TextInputType } from '../../../../../types'

type Props = {
  intl: $IntlShape,
  input: TextInputType,
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

  handleMaxChange = (e) => {
    const { input: { value, onChange } } = this.props

    onChange({
      ...value,
      restrictions: {
        ...value.restrictions,
        max: e.target.value,
      },
    })
  }

  handleMinChange = (e) => {
    const { input: { value, onChange } } = this.props

    onChange({
      ...value,
      restrictions: {
        ...value.restrictions,
        min: e.target.value,
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
          <div>
            <label htmlFor="min">Min</label>
            <input name="min" type="number" value={value.restrictions.min} onChange={e => this.handleMinChange(e)} />
            <label htmlFor="max">Max</label>
            <input name="max" type="number" value={value.restrictions.max} onChange={e => this.handleMaxChange(e)} />
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
        `}</style>
      </div>
    )
  }
}

export default Options
