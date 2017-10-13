import React from 'react'
import PropTypes from 'prop-types'
import QuestionDropzone from './QuestionDropzone'
import QuestionSingle from '../../questions/QuestionSingle'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
}

const SessionTimelineInput = ({ input: { value, onChange } }) => {
  const handleNewQuestion = (newQuestion) => {
    onChange([...value, newQuestion])
  }

  return (
    <div className="sessionTimeline">
      {value.map(question => (
        <div key={question.id} className="timelineItem">
          <QuestionSingle id={question.id} title={question.title} type={question.type} />
        </div>
      ))}
      <div className="timelineItem">
        <QuestionDropzone onDrop={handleNewQuestion} />
      </div>
      <style jsx>{`
        .sessionTimeline {
          display: flex;
          flex-direction: row;

          border-left: 1px solid lightgrey;
          border-bottom: 1px solid lightgrey;
          height: 100%;
          padding: 0.5rem;
        }

        .sessionTimeline > .timelineItem {
          border: 1px solid lightgrey;
          width: 12rem;
        }

        .sessionTimeline > .timelineItem:not(:last-child) {
          margin-right: 0.5rem;
        }
      `}</style>
    </div>
  )
}

SessionTimelineInput.propTypes = propTypes

export default SessionTimelineInput
