import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

const QuestionBlock = ({ questions, showSolutions, status, timeLimit }) =>
  (<div className="questionBlock">
    {
      status
        ? <div className="timeLimit">
          {status}
        </div>
        : <div className="timeLimit">
          <Icon name="clock" />{timeLimit}s
        </div>
    }
    {
      status
        ? <div className="showSolution">
          {status}
        </div>
        : <div className="showSolution">
          <Icon name={showSolutions ? 'unhide' : 'hide'} />
        </div>
    }
    <div className="questions">
      {questions.map(({ id, title, type }) =>
        (<div className="question">
          <QuestionSingle id={id} title={title} type={type} />
        </div>),
      )}
    </div>

    <style jsx>{`
      .questionBlock,
      .questions {
        display: flex;
      }
      .questionBlock {
        background-color: lightgrey;
        border: 1px solid grey;
        flex-flow: row wrap;
        padding: 0.2rem;
      }
      .questions {
        flex-flow: column nowrap;
      }
      .timeLimit,
      .showSolution {
        flex: 1 1 50%;
        margin-bottom: 0.2rem;
      }
      .showSolution {
        text-align: right;
      }
      .question {
        background-color: lightgrey;
        border: 1px solid grey;
        flex: 1;
      }
      .question:not(:first-child) {
        margin-top: 0.2rem;
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
  showSolutions: PropTypes.bool,
  status: PropTypes.string,
  timeLimit: PropTypes.number,
}

QuestionBlock.defaultProps = {
  questions: [],
  showSolutions: false,
  status: null,
  timeLimit: null,
}

export default QuestionBlock
