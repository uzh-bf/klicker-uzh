import React from 'react'
import PropTypes from 'prop-types'
import { Button as SemanticButton } from 'semantic-ui-react'

const propTypes = {
  children: PropTypes.node.isRequired,
}

function Button({ children, ...props }) {
  return (
    <div className="klicker-button">
      <SemanticButton fluid {...props}>
        {children}
      </SemanticButton>

      <style jsx>{`
        @import 'src/_theme';

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

Button.propTypes = propTypes

export default Button
