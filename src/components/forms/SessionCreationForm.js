import React from 'react'
import PropTypes from 'prop-types'
import isEmpty from 'validator/lib/isEmpty'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage } from 'react-intl'
import { FaFloppyO, FaPlay, FaTrash } from 'react-icons/lib/fa'

import { SemanticInput } from '.'
import { SessionTimelineInput } from '../sessions'

// form validation
const validate = ({ sessionName, questions }) => {
  const errors = {}

  if (!sessionName || isEmpty(sessionName)) {
    errors.sessionName = 'form.createSession.sessionName.empty'
  }

  if (!questions || questions.length === 0) {
    errors.questions = 'form.createSession.questions.empty'
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
    <div className="sessionName">
      <Field component={SemanticInput} label="Name" name="sessionName" />
    </div>

    <div className="sessionTimeline">
      <Field component={SessionTimelineInput} name="blocks" />
    </div>

    <div className="actionArea">
      <button className="ui fluid button" type="button" onClick={onDiscard}>
        <FaTrash />
        <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
      </button>
      <button className="ui fluid button" disabled={invalid} type="submit">
        <FaFloppyO />
        <FormattedMessage defaultMessage="Save" id="common.button.save" />
      </button>
      <button
        className="ui fluid primary button"
        disabled={invalid}
        type="button"
        onClick={handleSubmit(onStart)}
      >
        <FaPlay />
        <FormattedMessage defaultMessage="Start" id="common.button.start" />
      </button>
    </div>

    <style jsx>{`
      .sessionCreation {
        display: flex;
        flex-flow: row wrap;

        background-color: white;
      }

      .sessionName {
        flex: 0 0 100%;

        border: 1px solid lightgrey;
        padding: 0.5rem;
        text-align: center;
      }

      .sessionName > .editButton {
        margin-left: 0.5rem;
      }

      .sessionTimeline {
        flex: 1;
      }

      .actionArea {
        flex: 0 0 10rem;

        border: 1px solid lightgrey;
        border-top: 0;
        padding: 0.5rem;
      }

      .actionArea > .button:not(:last-child) {
        margin-bottom: 0.5rem;
      }

      .actionArea > .button:first-child {
        margin-bottom: 2rem;
      }

      .actionArea > .button > :global(svg) {
        margin-right: 0.4rem;
        margin-top: -3px;
      }
    `}</style>
  </form>
)

SessionCreationForm.propTypes = propTypes

export default reduxForm({
  form: 'createSession',
  initialValues: {
    blocks: [],
  },
  validate,
})(SessionCreationForm)
