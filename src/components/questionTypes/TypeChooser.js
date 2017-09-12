// @flow

import React from 'react'
import classNames from 'classnames'
import { FormattedMessage } from 'react-intl'

type Props = {
  intl: $IntlShape,
  input: {
    value: string,
    onChange: string => void,
  }
}

const TypeChooser = ({ intl, input: { value, onChange } }: Props) => {
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

  return (
    <div className="field">
      <label htmlFor="types">
        <FormattedMessage defaultMessage="Question type" id="teacher.createQuestion.questionType" />
      </label>
      <div className="typeChooser">
        {types.map(({ name, value: typeValue }) => (
          <button
            key={typeValue}
            className={classNames('type', { active: typeValue === value })}
            type="button"
            onClick={onChange(typeValue)}
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
          margin-bottom: 0.5rem;
        }

        .typeChooser {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  )
}

export default TypeChooser
