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
        border: 1px solid green !important;

        animation: bounce .5s;
      }

      // TODO: improve animation
      @keyframes bounce {
        0%, 100% {
          transform: translateX(0)
        }
        50% {
          transform: translateY(-2px)
        }
      }
    `}</style>
  </div>)

export default SingleChoiceOptions
