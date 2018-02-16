import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

const propTypes = {
  index: PropTypes.number,
  noDetails: PropTypes.bool,
  questions: PropTypes.arrayOf(PropTypes.shape(QuestionSingle.propTypes)).isRequired,
  status: PropTypes.string,
  timeLimit: PropTypes.number,
}

const defaultProps = {
  index: undefined,
  noDetails: false,
  status: 'PLANNED',
  timeLimit: undefined,
}

const QuestionBlock = ({
  index, status, questions, timeLimit, noDetails,
}) => (
  <div className={classNames('questionBlock', { active: status === 'ACTIVE' })}>
    {index >= 0 && <div className="index">Block {index}</div>}
    {!noDetails &&
      timeLimit && (
        <div className="timeLimit">
          <Icon name="clock" />
          {timeLimit}s
        </div>
      )}
    {!noDetails && <div className="sessionStatus">{status}</div>}
    <div className="questions">
      {questions.map((question, singleIndex) => (
        // HACK: prettier failure with destructuring for question
        <QuestionSingle
          id={question.id}
          index={singleIndex + 1}
          key={question.id}
          title={question.title}
          type={question.type}
          version={question.version}
        />
      ))}
    </div>
    <style jsx>{`
      @import 'src/theme';

      .questionBlock {
        display: flex;

        background-color: #eaeaea;
        border: 2px solid #c5c5c5;
        flex-flow: row wrap;
        padding: 0.2rem;

        &.active {
          border: 2px solid rgb(0, 97, 0);
          background-color: rgb(198, 293, 206);
        }

        .index,
        .timeLimit,
        .showSolution,
        .sessionStatus {
          flex: 1 1 33%;
          margin-bottom: 0.2rem;
        }

        .index {
          font-weight: bold;
        }

        .showSolution {
          text-align: center;
        }

        .sessionStatus {
          text-align: right;
        }

        .questions {
          flex: 0 0 100%;
          height: 100%;
          background-color: white;

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
