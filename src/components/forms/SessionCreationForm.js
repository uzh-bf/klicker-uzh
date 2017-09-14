// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'
import { FaEdit, FaTrash, FaPlay, FaFloppyO } from 'react-icons/lib/fa'

import QuestionSingle from '../questions/QuestionSingle'
import QuestionDropzone from './components/QuestionDropzone'

type Props = {
  handleSubmit: () => void,
  onDiscard: () => void,
}

class SessionCreationForm extends React.Component {
  props: Props

  state = {
    questions: [],
  }

  handleNewQuestion = (newQuestion) => {
    this.setState(prevState => ({
      questions: [...prevState.questions, newQuestion],
    }))
  }

  handleDiscard = () => {
    this.props.onDiscard()
  }

  handleStart = (values) => {
    this.props.handleSubmit(values)
  }

  render() {
    return (
      <form className="ui form sessionCreation">
        <div className="sessionTitle">
          Some Title{' '}
          <span className="editButton">
            <FaEdit />
          </span>
        </div>

        <div className="sessionTimeline">
          {this.state.questions.map(question => (
            <div key={question.id} className="timelineItem">
              <QuestionSingle id={question.id} title={question.title} type={question.type} />
            </div>
          ))}
          <div className="timelineItem">
            <QuestionDropzone onDrop={this.handleNewQuestion} />
          </div>
        </div>

        <div className="actionArea">
          <button className="ui fluid button" type="button" onClick={this.handleDiscard}>
            <FaTrash />
            <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
          </button>
          <button className="ui fluid button" type="submit">
            <FaFloppyO />
            <FormattedMessage defaultMessage="Save" id="common.button.save" />
          </button>
          <button className="ui fluid primary button" type="button">
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
            display: flex;
            flex-direction: row;

            border-left: 1px solid lightgrey;
            border-bottom: 1px solid lightgrey;
            padding: 0.5rem;
          }

          .sessionTimeline > .timelineItem {
            border: 1px solid lightgrey;
            width: 12rem;
          }

          .sessionTimeline > .timelineItem:not(:last-child) {
            margin-right: 0.5rem;
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
  }
}

export default SessionCreationForm
