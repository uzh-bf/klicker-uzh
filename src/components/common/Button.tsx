import React from 'react'
import { Button as SemanticButton } from 'semantic-ui-react'

interface Props {
  active?: boolean
  type?: string
  onClick: () => void
  children: React.ReactNode
}

function Button({ children, ...props }: Props): React.ReactElement {
  return (
    <div className="klicker-button">
      <SemanticButton fluid {...props}>
        {typeof children === 'function' ? children() : children}
      </SemanticButton>

      <style jsx>{`
        @import 'src/theme';

        .klicker-button {
          > :global(button) {
            background-color: #ffffff;
            border: 1px solid $color-primary-20p;

            &:hover,
            &:focus {
              background-color: $color-primary-10p;
            }
          }

          > :global(button.active) {
            background-color: #ffffff;
            border: 1px solid $color-primary;

            &:focus {
              background-color: $color-primary-10p;
            }
          }
        }
      `}</style>
    </div>
  )
}

export default Button
