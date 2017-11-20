import React from 'react'
import PropTypes from 'prop-types'
import { Button, Menu } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  activeIndex: PropTypes.number.isRequired,
  isSkipModeActive: PropTypes.bool,
  isSubmitDisabled: PropTypes.bool,
  items: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
  setActiveIndex: PropTypes.func.isRequired,
}

const defaultProps = {
  isSkipModeActive: true,
  isSubmitDisabled: false,
}

function ActionMenu({
  activeIndex,
  isSkipModeActive,
  isSubmitDisabled,
  items,
  setActiveIndex,
  onSubmit,
}) {
  return (
    <div className="actionMenu">
      <Menu borderless className="noBorder">
        {items.map(({ done }, index) => (
          <Menu.Item
            active={index === activeIndex}
            disabled={done}
            icon={done ? 'checkmark' : 'hand pointer'}
            onClick={setActiveIndex(index)}
          />
        ))}
        <Menu.Item className="submitButton" position="right">
          <Button fluid primary disabled={isSubmitDisabled} onClick={onSubmit}>
            {isSkipModeActive ? (
              <FormattedMessage defaultMessage="Skip" id="common.string.skip" />
            ) : (
              <FormattedMessage defaultMessage="Submit" id="common.string.submit" />
            )}
          </Button>
        </Menu.Item>
      </Menu>

      <style jsx>{`
        @import 'src/theme';

        .actionMenu {
          border-top: 1px solid $color-primary-20p;

          :global(.item.active) {
            background-color: $color-primary-50p;

            &:hover {
              background-color: $color-primary-50p;
            }
          }

          :global(.item.submitButton button.button) {
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}

ActionMenu.propTypes = propTypes
ActionMenu.defaultProps = defaultProps

export default ActionMenu
