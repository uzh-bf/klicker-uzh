// @flow

import classNames from 'classnames'
import React from 'react'

import PlaceholderInput from './PlaceholderInput'

const Option = ({ correct, name, handleCorrectChange, handleDelete }) => (
  <div className={classNames('option', { correct })}>
    {name}

    <style jsx>{`
      .option {
        border: 1px solid grey;
        padding: 1rem;
        text-align: center;
      }
      .option:not(:last-child) {
        margin-bottom: 0.5rem;
      }

      .option:hover {
      }

      .correct {
        border-color: green;
      }
    `}</style>
  </div>
)

type Props = {
  options: Array<{
    correct: boolean,
    name: string,
  }>,
  handleNewOption: {
    correct: boolean,
    name: string,
  },
}

const defaultProps = {
  options: [],
}

const SCCreationOptions = ({ options, handleNewOption }: Props) => (
  <div className="options">
    {options.map(({ correct, name }) => <Option correct={correct} name={name} />)}

    <PlaceholderInput handleSave={handleNewOption} />

    <style jsx>{''}</style>
  </div>
)

SCCreationOptions.defaultProps = defaultProps

export default SCCreationOptions
