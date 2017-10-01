// @flow

import * as React from 'react'
import classNames from 'classnames'
import { Button } from 'semantic-ui-react'

import type { OptionType } from '../../../../types'

type Props = {
  activeOption: number,
  options: Array<OptionType>,
  onOptionClick: (optionNumber: number) => () => mixed,
}

const Options = ({ activeOption, options, onOptionClick }: Props) => (
  <div className="options">
    {options.map((option, index) => (
      <div key={option.name} className={classNames('option', { active: index === activeOption })}>
        <Button basic fluid onClick={onOptionClick && onOptionClick(index)}>
          {option.name}
        </Button>
      </div>
    ))}

    <style jsx>{`
      :global(.option:not(:last-child)) {
        margin-bottom: 0.5rem;
      }

      .option.active :global(button) {
        border: 1px solid green !important;

        animation: bounce 0.5s;
      }

      // TODO: improve animation
      @keyframes bounce {
        0%,
        100% {
          transform: translateX(0);
        }
        50% {
          transform: translateY(-2px);
        }
      }
    `}</style>
  </div>
)

export default Options
