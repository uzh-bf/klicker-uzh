import React from 'react'
import clsx from 'clsx'
import { Button } from 'semantic-ui-react'

interface Props {
  disabled?: boolean
  onChange: any
  options?: {
    id: string
    name: string
  }[]
  value?: number[]
}

const defaultProps = {
  disabled: false,
  onChange: (f): any => f,
  options: [],
  value: [],
}

function SCAnswerOptions({ value, disabled, options, onChange }: Props): React.ReactElement {
  return (
    <div className="options">
      {options.map(
        (option, index): React.ReactElement => (
          <div className={clsx('option', { active: value.includes(index) })} key={option.id}>
            <Button fluid disabled={disabled} onClick={onChange(index)}>
              {option.name}
            </Button>
          </div>
        )
      )}

      <style jsx>{`
        @import 'src/theme';

        $button-border-width: 2px;

        .options > .option {
          &:not(:last-child) {
            margin-bottom: 0.5rem !important;
          }

          :global(button),
          :global(button.disabled) {
            border: $button-border-width solid lightgray !important;
            background-color: lightgray !important;
          }

          &.active {
            :global(button),
            :global(button.disabled) {
              border: $button-border-width solid rgb(0, 97, 0) !important;
              background-color: rgb(198, 239, 206) !important;
              color: rgb(0, 97, 0) !important;

              animation: bounce 0.5s;
            }
          }
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
}

SCAnswerOptions.defaultProps = defaultProps

export default SCAnswerOptions
