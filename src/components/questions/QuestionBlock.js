import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

const propTypes = {
  questions: PropTypes.arrayOf(PropTypes.shape(QuestionSingle.propTypes)).isRequired,
  showSolutions: PropTypes.bool,
  timeLimit: PropTypes.number,
}

const defaultProps = {
  showSolutions: false,
  timeLimit: 0,
}

const QuestionBlock = ({ questions, showSolutions, timeLimit }) => (
  <div className="questionBlock">
    <div className="timeLimit">
      <Icon name="clock" />
      {timeLimit}s
    </div>
    <div className="showSolution">
      <Icon name={showSolutions ? 'unhide' : 'hide'} />
    </div>
    <div className="questions">
      {questions.map(({ id, title, type }) => (
        <QuestionSingle key={id} id={id} title={title} type={type} />
      ))}
    </div>
    <style jsx>{`
      .questionBlock {
        display: flex;

        background-color: lightgrey;
        border: 1px solid grey;
        flex-flow: row wrap;
        padding: 0.2rem;

        .timeLimit,
        .showSolution {
          flex: 1 1 50%;
          margin-bottom: 0.2rem;
        }

        .showSolution {
          text-align: right;
        }

        .questions {
          display: flex;
          flex-flow: column nowrap;

          > :global(*) {
            border: 1px solid grey;
            flex: 1;

            &:not(:first-child) {
              margin-top: 0.2rem;
            }
          }
        }
      }
    `}</style>
  </div>
)

QuestionBlock.propTypes = propTypes
QuestionBlock.defaultProps = defaultProps

export default QuestionBlock
