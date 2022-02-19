import React from 'react'
import clsx from 'clsx'
import { Button } from 'semantic-ui-react'
import useMarkdown from '../../../lib/hooks/useMarkdown'

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

function Option({ active, children, disabled, id, onClick }) {
  const content = useMarkdown({ content: children })
  return (
    <div className={clsx('option', { active })} key={id}>
      <Button fluid className="mr-0" disabled={disabled} onClick={onClick}>
        {content}
      </Button>

      <style jsx>{`
        @import 'src/theme';

        :global(button .math) {
          font-size: 0.8em;
        }

        .option.active {
          :global(button),
          :global(button.disabled) {
            border: 2px solid rgb(0, 97, 0) !important;
            background-color: rgb(198, 239, 206) !important;
            color: rgb(0, 97, 0) !important;

            animation: bounce 0.3s;
          }
        }

        // TODO: improve animation
        @keyframes bounce {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  )
}

function SCAnswerOptions({ value, disabled, options, onChange }: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {options.map(
        (option, index): React.ReactElement => (
          <Option
            active={value.includes(index)}
            disabled={disabled}
            id={option.id}
            key={option.id}
            onClick={onChange(index)}
          >
            {option.name}
          </Option>
        )
      )}
    </div>
  )
}

SCAnswerOptions.defaultProps = defaultProps

export default SCAnswerOptions
