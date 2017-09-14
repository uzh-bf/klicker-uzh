// @flow

import React from 'react'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'

import type { TextInputType } from '../../../../../types'

type Props = {
  intl: $IntlShape,
  input: TextInputType,
}

const Options = ({ intl, input: { value, onChange } }: Props) => {
  const options = [
    {
      name: intl.formatMessage({
        defaultMessage: 'No Limitations',
        id: 'teacher.createQuestion.options.noLimitations',
      }),
      value: 'NOLIMIT',
    },
    {
      name: intl.formatMessage({
        defaultMessage: 'Number Range',
        id: 'teacher.createQuestion.options.numberRange',
      }),
      value: 'NUMBER',
    },
  ]

  const handleClick = newValue => () => onChange(newValue)

  return (
    <div className="field">
      <label htmlFor="options">
        <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
      </label>
      <div className="optionsChooser">
        {options.map(({ name, value: optionValue }) => (
          <button
            key={optionValue}
            className={classNames('option', { active: optionValue === value })}
            onClick={handleClick(optionValue)}
            type="button"
          >
            {name}
          </button>
        ))}
      </div>
      <label htmlFor="min">Min</label>
      <input />
      <label htmlFor="max">Max</label>
      <input />


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

export default Options
