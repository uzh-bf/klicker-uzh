import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Icon, Form } from 'semantic-ui-react'
import Yup from 'yup'
import _isEmpty from 'lodash/isEmpty'
import { compose, withProps } from 'recompose'

import { SessionTimelineInput } from '../sessions'

const propTypes = {
  name: PropTypes.string.isRequired,
  blocks: PropTypes.array.isRequired,
  handleChangeName: PropTypes.func.isRequired,
  handleChangeBlocks: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  handleDiscard: PropTypes.func.isRequired,
}

const SessionCreationForm = ({
  name,
  blocks,
  handleChangeName,
  handleChangeBlocks,
  handleSubmit,
  handleDiscard,
}) => (
  <form className="ui form sessionCreation" onSubmit={handleSubmit('save')}>
    <div className="upper">
      <h2 className="title">
        <FormattedMessage defaultMessage="Create Session" id="sessionCreation.title" />
      </h2>

      <div className="sessionSettings">
        <div className="sessionName">
          <input type="text" value={name} onChange={handleChangeName} />
        </div>
      </div>
    </div>

    <div className="sessionTimeline">
      <SessionTimelineInput value={blocks} onChange={handleChangeBlocks} />
    </div>

    <div className="actionArea">
      <Button fluid icon labelPosition="left" onClick={handleDiscard}>
        <Icon name="trash" />
        <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
      </Button>

      <Button
        fluid
        icon
        // disabled={!_isEmpty(errors)}
        labelPosition="left"
        // loading={isSubmitting}
        type="submit"
      >
        <Icon name="save" />
        <FormattedMessage defaultMessage="Save & Close" id="form.createSession.button.save" />
      </Button>

      <Button
        fluid
        icon
        primary
        // disabled={!_isEmpty(errors)}
        labelPosition="left"
        // loading={isSubmitting}
        onClick={handleSubmit('start')}
      >
        <Icon name="play" />
        <FormattedMessage defaultMessage="Start" id="common.button.start" />
      </Button>
    </div>

    <style jsx>{`
      @import 'src/theme';

      .sessionCreation {
        display: flex;
        flex-flow: row wrap;

        background-color: white;

        .title {
          font-size: 1.5rem;
          margin: 0;

          padding: 0.5rem 1rem;
        }

        .upper {
          flex: 0 0 100%;

          border-bottom: 1px solid lightgrey;
          border-top: 1px solid lightgrey;
          text-align: center;
          padding: 0 1rem 1rem 1rem;
        }

        .sessionTimeline {
          flex: 1;
        }

        .actionArea {
          flex: 0 0 auto;

          border: 1px solid lightgrey;
          border-top: 0;
          padding: 0.5rem;

          > :global(button) {
            :global(span) {
              margin-left: 2rem;
            }

            &:not(:last-child) {
              margin-bottom: 0.5rem;
            }

            &:first-child {
              margin-bottom: 2rem;
            }
          }
        }
      }
    `}</style>
  </form>
)

SessionCreationForm.propTypes = propTypes

export default SessionCreationForm
