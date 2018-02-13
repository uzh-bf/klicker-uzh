import React from 'react'
import PropTypes from 'prop-types'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'
import moment from 'moment'

import { SemanticInput } from '.'
import { SessionTimelineInput } from '../sessions'

// form validation
const validate = ({ blocks }) => {
  const errors = {}

  if (!blocks || blocks.length === 0) {
    errors.blocks = 'form.createSession.blocks.empty'
  }

  return errors
}

const propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  invalid: PropTypes.bool.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
}

const SessionCreationForm = ({
  invalid, handleSubmit, onSave, onDiscard, onStart,
}) => (
  <form className="ui form sessionCreation" onSubmit={handleSubmit(onSave)}>
    <div className="upper">
      <h2 className="title">
        <FormattedMessage defaultMessage="Create Session" id="teacher.sessionCreation.title" />
      </h2>

      <div className="sessionSettings">
        <div className="sessionName">
          <Field
            component={SemanticInput}
            inlineLabel="Name"
            labelPosition="left"
            name="sessionName"
            placeholder="Session #1"
          />
        </div>
      </div>
    </div>

    <div className="sessionTimeline">
      <Field component={SessionTimelineInput} name="blocks" />
    </div>

    <div className="actionArea">
      <Button fluid icon labelPosition="left" onClick={onDiscard}>
        <Icon name="trash" />
        <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
      </Button>

      <Button fluid icon disabled={invalid} labelPosition="left" type="submit">
        <Icon name="save" />
        <FormattedMessage defaultMessage="Save & Close" id="form.createSession.button.save" />
      </Button>

      <Button
        fluid
        icon
        primary
        disabled={invalid}
        labelPosition="left"
        onClick={handleSubmit(onStart)}
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

export default reduxForm({
  form: 'createSession',
  initialValues: {
    blocks: [],
    // initialize session name to the current date and time
    sessionName: moment().format('DD.MM.YYYY HH:mm'),
  },
  validate,
})(SessionCreationForm)
