// @flow

import React from 'react'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'

import type { TextInputType } from '../../../../../types'

type Props = {
  intl: $IntlShape,
  input: TextInputType,
}

const Options = ({ intl, input: { value } }: Props) => {
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
            type="button"
          >
            {name}
          </button>
        ))}
      </div>

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
