// @flow

import React from 'react'

import Placeholder from './Placeholder'
import Option from './Option'

type Props = {
  options: Array<{
    correct: boolean,
    name: string,
  }>,
  handleNewOption: ({
    correct: boolean,
    name: string,
  }) => void,
  handleDeleteOption: number => () => void,
  handleOptionToggleCorrect: number => () => void,
}

const defaultProps = {
  options: [],
}

const Options = ({
  options,
  handleOptionToggleCorrect,
  handleDeleteOption,
  handleNewOption,
}: Props) => (
  <div className="options">
    {options.map(({ correct, name }, index) => (
      <div>
        <Option
          correct={correct}
          name={name}
          handleCorrectToggle={handleOptionToggleCorrect(index)}
          handleDelete={handleDeleteOption(index)}
        />
      </div>
    ))}

    <Placeholder handleSave={handleNewOption} />

    <style jsx>{`
      .options > div:not(:last-child) {
        margin-bottom: 0.5rem;
      }
    `}</style>
  </div>
)

Options.defaultProps = defaultProps

export default Options
