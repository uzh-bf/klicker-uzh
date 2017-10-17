import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Button } from 'semantic-ui-react'

const propTypes = {
  activeOption: PropTypes.number.isRequired,
  handleOptionClick: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  options: [],
}

const SCAnswerOptions = ({ activeOption, options, handleOptionClick }) => (
  <div className="options">
    {options.map((option, index) => (
      <div key={option.id} className={classNames('option', { active: index === activeOption })}>
        <Button basic fluid onClick={handleOptionClick && handleOptionClick(index)}>
          {option.label}
        </Button>
      </div>
    ))}

    <style jsx>{`
      .options {
        .option {
          :global(&:not(:last-child)) {
            margin-bottom: 0.5rem;
          }

          &.active :global(button) {
            border: 1px solid green !important;

            animation: bounce 0.5s;
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
      }
    `}</style>
  </div>
)

SCAnswerOptions.propTypes = propTypes
SCAnswerOptions.defaultProps = defaultProps

export default SCAnswerOptions
