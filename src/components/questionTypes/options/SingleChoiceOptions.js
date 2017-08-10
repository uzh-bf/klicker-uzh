// @flow

import React from 'react'
import { Button } from 'semantic-ui-react'

type Props = {
  options: Array<{
    label: string,
  }>,
  handleOptionClick: (optionNumber: number) => () => mixed,
}

const SingleChoiceOptions = ({ options, handleOptionClick }: Props) =>
  (<div className="options">
    {options.map(option =>
      (<div className="option">
        <Button basic fluid className="optionButton" onClick={handleOptionClick(0)}>
          {option.label}
        </Button>
      </div>),
    )}

    <style jsx>{`
      :global(.option:not(:last-child)) {
        margin-bottom: .5rem;
      }
    `}</style>
  </div>)

export default SingleChoiceOptions
