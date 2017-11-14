import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

const propTypes = {
  questions: PropTypes.arrayOf(PropTypes.shape(QuestionSingle.propTypes)).isRequired,
  showSolutions: PropTypes.bool,
  status: PropTypes.string,
  timeLimit: PropTypes.number,
}

const defaultProps = {
  showSolutions: false,
  status: 'PLANNED',
  timeLimit: 0,
}

const QuestionBlock = ({ status, questions, timeLimit }) => (
  <div className="questionBlock">
    <div className="timeLimit">
      <Icon name="clock" />
      {timeLimit}s
    </div>
    {/* <div className="showSolution">
      <Icon name={showSolutions ? 'unhide' : 'hide'} />
    </div> */}
    <div className="sessionStatus">{status}</div>
    <div className="questions">
      {questions.map(({ id, title, type }) => (
        <QuestionSingle key={id} id={id} title={title} type={type} description={'desc'} />
      ))}
    </div>
    <style jsx>{`
      .questionBlock {
        display: flex;

        background-color: lightgrey;
        border: ${status === 'ACTIVE' ? '2px solid green' : '1px solid grey'};
        flex-flow: row wrap;
        padding: 0.2rem;

        .timeLimit,
        .showSolution,
        .sessionStatus {
          flex: 1 1 33%;
          margin-bottom: 0.2rem;
        }

        .showSolution {
          text-align: center;
        }

        .sessionStatus {
          text-align: right;
        }

        .questions {
          flex: 0 0 100%;

          > :global(*) {
            border: 1px solid grey;

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
