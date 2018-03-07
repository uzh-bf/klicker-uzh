import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

const propTypes = {
  creationMode: PropTypes.bool,
  handleCreationModeToggle: PropTypes.func.isRequired,
  itemsChecked: PropTypes.number,
}

const defaultProps = {
  creationMode: false,
  itemsChecked: 0,
}

function ActionBar({ creationMode, handleCreationModeToggle, itemsChecked }) {
  return (
    <div className="actionBar">
      <div className="actionButtons">
        <Link href="/questions/create">
          <Button primary>
            <FormattedMessage
              defaultMessage="Create Question"
              id="questionPool.button.createQuestion"
            />
          </Button>
        </Link>

        <Button primary disabled={!!creationMode} onClick={handleCreationModeToggle}>
          <FormattedMessage
            defaultMessage="Create Session"
            id="questionPool.button.createSession"
          />
        </Button>
      </div>

      {creationMode && (
        <React.Fragment>
          <div className="creationButtons">
            <Button icon labelPosition="left">
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Split into {num} block{end}"
                id="questionPool.button.quickCreateSeparate"
                values={{
                  end: '',
                  num: +itemsChecked,
                }}
              />
            </Button>

            <Button icon labelPosition="left">
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Group into one block"
                id="questionPool.button.quickCreateSingle"
              />
            </Button>
          </div>
          <div className="checkedCounter">
            <FormattedMessage
              defaultMessage="{count} items checked."
              id="questionPool.itemsChecked"
              values={{
                count: 1,
              }}
            />
          </div>
        </React.Fragment>
      )}

      <style jsx>{`
        @import 'src/theme';

        .actionBar,
        .actionButtons,
        .creationButtons {
          display: flex;
          flex-direction: column;
        }

        .actionBar {
          border: 1px solid $color-primary;
          padding: 0.3rem;

          .actionButtons,
          .creationButtons {
            flex: 1;
          }

          @include desktop-tablet-only {
            flex-direction: row;
            align-items: center;
            justify-content: ${creationMode ? 'space-between' : 'flex-end'};

            .creationButtons,
            .actionButtons {
              flex: 0 0 auto;
              flex-direction: row;

              > :global(button:last-child) {
                margin-right: 0;
              }
            }

            .checkedCounter {
              color: grey;
              order: 1;
            }

            .creationButtons {
              order: 2;
            }

            .actionButtons {
              order: 3;
            }
          }
        }
      `}</style>
    </div>
  )
}

ActionBar.propTypes = propTypes
ActionBar.defaultProps = defaultProps

export default ActionBar
