import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'semantic-ui-react'

const propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      handleClick: PropTypes.func.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  items: [],
}

const ActionButton = ({ items }) => (
  <div className="actionButtonWrapper">
    <div className="actionButton">
      <Button circular primary icon="plus" size="large" />
    </div>
    <div className="ui vertical text menu buttonMenu">
      {items.map(item => (
        <button className="item" onClick={item.handleClick}>
          {item.label}
        </button>
      ))}
    </div>

    <style jsx>{`
      .actionButtonWrapper {
        display: flex;
        flex-direction: column;

        max-width: 7rem;
      }

      .buttonMenu {
        flex: 1;
        order: 0;
      }

      .buttonMenu .item {
        opacity: 0;
        transform: scale(0) translateX(10rem);
        transition: transform 0.3s ease-in-out, opacity 0.3s ease-in;
      }

      .actionButton {
        flex: 0 0 auto;
        align-self: flex-end;
        order: 1;

        transition: transform 0.5s ease-in-out;
      }

      .actionButton:hover + .buttonMenu .item {
        opacity: 1;
        transform: scale(1) translateX(0);
      }

      .actionButton:hover {
        transform: rotate(45deg);
      }

      .actionButton :global(button) {
        margin-right: 0;
      }
    `}</style>
  </div>
)

ActionButton.propTypes = propTypes
ActionButton.defaultProps = defaultProps

export default ActionButton
