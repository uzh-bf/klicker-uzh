import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button, Icon, Input } from 'semantic-ui-react'
import Yup from 'yup'

import { SessionTimelineInput } from '../sessions'

const propTypes = {
  blocks: PropTypes.array.isRequired,
  handleChangeBlocks: PropTypes.func.isRequired,
  handleChangeName: PropTypes.func.isRequired,
  handleDiscard: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  isSessionRunning: PropTypes.bool.isRequired,
  name: PropTypes.string.isRequired,
}

const schema = Yup.object().shape({
  blocks: Yup.array().required(),
  name: Yup.string()
    .min(1)
    .required(),
})

const SessionCreationForm = ({
  name,
  blocks,
  isSessionRunning,
  handleChangeName,
  handleChangeBlocks,
  handleSubmit,
  handleDiscard,
}) => {
  // synchronously validate the schema
  const isValid = schema.isValidSync({
    blocks,
    name,
  })

  return (
    <form className="ui form sessionCreation" onSubmit={handleSubmit('save')}>
      <div className="upper">
        <h1 className="title">
          <FormattedMessage defaultMessage="Create Session" id="sessionCreation.title" />
        </h1>

        <div className="sessionSettings">
          <div className="sessionName">
            <Input fluid label="Name" type="text" value={name} onChange={handleChangeName} />
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

        <Button fluid icon disabled={!isValid} labelPosition="left" type="submit">
          <Icon name="save" />
          <FormattedMessage defaultMessage="Save & Close" id="form.createSession.button.save" />
        </Button>

        <Button
          fluid
          icon
          primary
          disabled={!isValid || isSessionRunning}
          labelPosition="left"
          onClick={handleSubmit('start')}
        >
          <Icon name="play" />
          <FormattedMessage defaultMessage="Start" id="common.button.start" />
        </Button>
        {isSessionRunning && (
          <FormattedMessage
            defaultMessage="A session is already running"
            id="form.createSession.string.alreadyRunning"
          />
        )}
      </div>

      <style jsx>{`
        @import 'src/theme';

        .sessionCreation {
          display: flex;
          flex-flow: row wrap;

          background-color: white;

          .title {
            color: $color-primary-strong;
            font-size: $font-size-h1;
            margin: 0;

            padding: 0.5rem 1rem;
          }

          .upper {
            flex: 0 0 100%;

            border-bottom: 1px solid lightgrey;
            border-top: 1px solid lightgrey;
            text-align: center;
            padding: 0 1rem 0.5rem 1rem;
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
}

SessionCreationForm.propTypes = propTypes

export default SessionCreationForm
