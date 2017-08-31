// @flow

import classNames from 'classnames'
import React from 'react'
import { FaTrash } from 'react-icons/lib/fa'

import PlaceholderInput from './PlaceholderInput'

const Option = ({ correct, name, handleCorrectToggle, handleDelete }) => (
  <div className={classNames('option', { correct })}>
    <button className="delete" onClick={handleDelete}>
      <FaTrash />
    </button>

    <button className={classNames('toggle', { correct })} onClick={handleCorrectToggle}>
      {correct ? 'TRUE' : 'FALSE'}
    </button>

    <div className="name">{name}</div>

    <style jsx>{`
      .option {
        display: flex;

        border: 1px solid grey;
      }

      .option:not(:last-child) {
        margin-bottom: 0.5rem;
      }

      .correct {
        border-color: green;
      }

      button {
        border: none;
        box-shadow: none;
        cursor: pointer;
        text-align: center;
      }

      .delete {
        border-right: 1px solid grey;
        padding: 1rem;
      }

      .toggle {
        background-color: red;
        border: 1px solid lightgrey;
        margin: 0.5rem;
        width: 4rem;
      }

      .toggle.correct {
        background-color: green;
      }

      .name {
        padding: 1rem;
      }
    `}</style>
  </div>
)

type Props = {
  options: Array<{
    correct: boolean,
    name: string,
  }>,
  handleNewOption: ({
    correct: boolean,
    name: string,
  }) => void,
  handleDeleteOption: (number) => () => void,
  handleOptionToggleCorrect: (number) => () => void,
}

const defaultProps = {
  options: [],
}

const SCCreationOptions = ({
  options,
  handleOptionToggleCorrect,
  handleDeleteOption,
  handleNewOption,
}: Props) => (
  <div className="options">
    {options.map(({ correct, name }, index) => (
      <Option
        correct={correct}
        name={name}
        handleCorrectToggle={handleOptionToggleCorrect(index)}
        handleDelete={handleDeleteOption(index)}
      />
    ))}

    <PlaceholderInput handleSave={handleNewOption} />
  </div>
)

SCCreationOptions.defaultProps = defaultProps

export default SCCreationOptions
