// @flow

import React from 'react'
import { Button } from 'semantic-ui-react'
import classNames from 'classnames'

type Props = {
  activeOption: number,
  options: Array<{
    label: string,
  }>,
  handleOptionClick: (optionNumber: number) => () => mixed,
}

const SingleChoiceOptions = ({ activeOption, options, handleOptionClick }: Props) =>
  (<div className="options">
    {options.map((option, index) =>
      (<div key={option.label} className={classNames('option', { active: index === activeOption })}>
        <Button basic fluid onClick={handleOptionClick(index)}>
          {option.label}
        </Button>
      </div>),
    )}

    <style jsx>{`
      :global(.option:not(:last-child)) {
        margin-bottom: .5rem;
      }

      .option.active :global(button) {
        border: 2px solid green !important;
        background-color: lightgrey !important;
      }
    `}</style>
  </div>)

export default SingleChoiceOptions
