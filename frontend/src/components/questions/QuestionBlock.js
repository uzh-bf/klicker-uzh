import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

const propTypes = {
  noDetails: PropTypes.bool,
  questions: PropTypes.arrayOf(PropTypes.shape(QuestionSingle.propTypes)).isRequired,
  status: PropTypes.string,
  timeLimit: PropTypes.number,
}

const defaultProps = {
  noDetails: false,
  status: 'PLANNED',
  timeLimit: 0,
}

const QuestionBlock = ({
  status, questions, timeLimit, noDetails,
}) => (
  <div className={classNames('questionBlock', { active: status === 'ACTIVE' })}>
    {!noDetails && (
      <div className="timeLimit">
        <Icon name="clock" />
        {timeLimit}s
      </div>
    )}
    {!noDetails && <div className="sessionStatus">{status}</div>}
    <div className="questions">
      {questions.map(({
 id, title, type, version,
}) => (
  <QuestionSingle id={id} key={id} title={title} type={type} version={version} />
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
