// @flow

import React from 'react'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage } from 'react-intl'
import { FaEdit, FaTrash, FaPlay, FaFloppyO } from 'react-icons/lib/fa'

import SessionTimeline from './components/SessionTimeline'

type Props = {
  handleSubmit: () => void,
  onDiscard: () => void,
  onSave: () => void,
  onStart: () => void,
}

const SessionCreationForm = ({ handleSubmit, onSave, onDiscard, onStart }: Props) => (
  <form className="ui form sessionCreation" onSubmit={handleSubmit(onSave)}>
    <div className="sessionTitle">
      Some Title{' '}
      <span className="editButton">
        <FaEdit />
      </span>
      <Field name="sessionName" component="input" />
    </div>

    <div className="sessionTimeline">
      <Field name="questions" component={SessionTimeline} />
    </div>

    <div className="actionArea">
      <button className="ui fluid button" type="button" onClick={handleSubmit(onDiscard)}>
        <FaTrash />
        <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
      </button>
      <button className="ui fluid button" type="submit">
        <FaFloppyO />
        <FormattedMessage defaultMessage="Save" id="common.button.save" />
      </button>
      <button className="ui fluid primary button" type="button" onClick={handleSubmit(onStart)}>
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

      .sessionTitle {
        flex: 0 0 100%;

        border: 1px solid lightgrey;
        padding: 0.5rem;
        text-align: center;
      }

      .sessionTitle > .editButton {
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

export default reduxForm({
  form: 'registration',
  initialValues: {
    questions: [],
  },
})(SessionCreationForm)
