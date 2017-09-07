// @flow

import React from 'react'
import classNames from 'classnames'

type Props = {
  activeType: string,
  types: Array<{
    name: string,
    value: string,
  }>,
  handleChange: string => () => void,
}

const TypeChooser = ({ activeType, types, handleChange }: Props) => (
  <div className="typeChooser">
    {types.map(({ name, value }) => (
      <button
        key={value}
        className={classNames('type', { active: value === activeType })}
        type="button"
        onClick={handleChange(value)}
      >
        {name}
      </button>
    ))}

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

export default TypeChooser
