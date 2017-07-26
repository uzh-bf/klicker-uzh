import React from 'react'
import PropTypes from 'prop-types'

import QuestionSingle from './QuestionSingle'

const QuestionBlock = ({ questions, showSolutions, timeLimit }) =>
  (<div className="container">
    <div className="timeLimit">
      Time limit {timeLimit}s
    </div>
    <div className="showSolution">
      {showSolutions ? 'ML' : 'NO ML'}
    </div>

    {questions.map(props =>
      (<div className="question">
        <QuestionSingle {...props} />
      </div>),
    )}

    <style jsx>{`
      .container {
        background-color: grey;
        display: flex;
        flex-flow: row wrap;
        padding: 0.2rem;
      }
      .timeLimit,
      .showSolution {
        width: 50%;
      }
      .showSolution {
        text-align: right;
      }
      .question {
        background-color: lightgrey;
        flex: 1 1 10rem;
      }
    `}</style>
  </div>)

QuestionBlock.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
    }),
  ),
  showSolutions: PropTypes.bool.isRequired,
  timeLimit: PropTypes.number.isRequired,
}

QuestionBlock.defaultProps = {
  questions: [],
}

export default QuestionBlock
