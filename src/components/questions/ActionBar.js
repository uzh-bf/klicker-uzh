import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

const propTypes = {
  creationMode: PropTypes.bool,
  handleArchiveQuestions: PropTypes.func.isRequired,
  handleCreationModeToggle: PropTypes.func.isRequired,
  handleQuickBlock: PropTypes.func.isRequired,
  handleQuickBlocks: PropTypes.func.isRequired,
  isArchiveActive: PropTypes.bool,
  itemsChecked: PropTypes.number,
}

const defaultProps = {
  creationMode: false,
  isArchiveActive: false,
  itemsChecked: 0,
}

function ActionBar({
  isArchiveActive,
  creationMode,
  handleCreationModeToggle,
  itemsChecked,
  handleQuickBlock,
  handleQuickBlocks,
  handleArchiveQuestions,
}) {
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

      <div className="creationButtons">
        {creationMode ? (
          <React.Fragment>
            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              onClick={() => handleQuickBlocks()}
            >
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Split into {num} block{end}"
                id="questionPool.button.quickCreateSeparate"
                values={{
                  end: itemsChecked > 1 ? 's' : '',
                  num: +itemsChecked,
                }}
              />
            </Button>

            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              onClick={() => handleQuickBlock()}
            >
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Group into one block"
                id="questionPool.button.quickCreateSingle"
              />
            </Button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              onClick={() => handleArchiveQuestions()}
            >
              <Icon name="archive" />
              {isArchiveActive ? (
                <FormattedMessage
                  defaultMessage="Unarchive {num} question{end}"
                  id="questionPool.button.unarchiveQuestions"
                  values={{
                    end: itemsChecked > 1 ? 's' : '',
                    num: +itemsChecked,
                  }}
                />
              ) : (
                <FormattedMessage
                  defaultMessage="Archive {num} question{end}"
                  id="questionPool.button.archiveQuestions"
                  values={{
                    end: itemsChecked > 1 ? 's' : '',
                    num: +itemsChecked,
                  }}
                />
              )}
            </Button>
          </React.Fragment>
        )}
      </div>

      <div className="checkedCounter">
        <FormattedMessage
          defaultMessage="{count} item{end} checked"
          id="questionPool.string.itemsChecked"
          values={{
            count: +itemsChecked,
            end: itemsChecked > 1 ? 's' : '',
          }}
        />
      </div>

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
            justify-content: space-between;

            .creationButtons,
            .actionButtons {
              flex: 0 0 auto;
              flex-direction: row;

              > :global(button:last-child) {
                margin-right: 0;
              }
            }

            .checkedCounter {
              padding-left: 1rem;

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
