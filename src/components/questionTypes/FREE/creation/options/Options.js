// @flow

import React from 'react'
import _get from 'lodash/get'
import classNames from 'classnames'
import { connect } from 'react-redux'
import { reduxForm } from 'redux-form'
import { FormattedMessage } from 'react-intl'

import type { TextInputType } from '../../../../../types'

type Props = {
  intl: $IntlShape,
  input: TextInputType,
}

const Options = ({ intl, input: { value, onChange }, options }: Props) => {
  const optionsData = [
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
        {optionsData.map(({ name, value: optionValue }) => (
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
      {
        options === 'NUMBER' &&
        <div>
          <label htmlFor="min">Min</label>
          <input />
          <label htmlFor="max">Max</label>
          <input />
        </div>
      }


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

const withState = connect(state => ({
  options: _get(state, 'form.createQuestion.values.options'),
}))

export default reduxForm({
  form: 'createQuestion',
})(withState(Options))
