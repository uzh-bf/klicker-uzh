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
      <div className={classNames('option', { active: value.includes(index) })} key={option.id}>
        <Button fluid disabled={disabled} onClick={onChange(index)}>
          {option.name}
        </Button>
      </div>
    ))}

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

SCAnswerOptions.propTypes = propTypes
SCAnswerOptions.defaultProps = defaultProps

export default SCAnswerOptions
