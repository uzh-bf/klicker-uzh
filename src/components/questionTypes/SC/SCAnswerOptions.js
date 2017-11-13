import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Button } from 'semantic-ui-react'

const propTypes = {
  disabled: PropTypes.bool,
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  value: PropTypes.arrayOf(PropTypes.number),
}

const defaultProps = {
  disabled: false,
  onChange: f => f,
  options: [],
  value: [],
}

const SCAnswerOptions = ({
  value, disabled, options, onChange,
}) => (
  <div className="options">
    {options.map((option, index) => (
      <div key={option.id} className={classNames('option', { active: value.includes(index) })}>
        <Button fluid disabled={disabled} onClick={onChange(index)}>
          {option.name}
        </Button>
      </div>
    ))}

    <style jsx>{`
      @import 'src/theme';

      .options > .option {
        &:not(:last-child) {
          margin-bottom: 0.5rem;
        }

        &.active {
          :global(button),
          :global(button.disabled) {
            border: 1px solid green !important;

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

SCAnswerOptions.propTypes = propTypes
SCAnswerOptions.defaultProps = defaultProps

export default SCAnswerOptions
