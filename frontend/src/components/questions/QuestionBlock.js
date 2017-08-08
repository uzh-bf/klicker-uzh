// @flow

import React from 'react'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

type Props = {
  questions: Array<{
    id: string,
    title: string,
    type: string,
  }>,
  showSolutions: boolean,
  timeLimit: number,
}

const defaultProps = {
  questions: [],
  showSolutions: false,
  timeLimit: 0,
}

const QuestionBlock = ({ questions, showSolutions, timeLimit }: Props) =>
  (<div className="questionBlock">
    <div className="timeLimit">
      <Icon name="clock" />
      {timeLimit}s
    </div>
    <div className="showSolution">
      <Icon name={showSolutions ? 'unhide' : 'hide'} />
    </div>
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

QuestionBlock.defaultProps = defaultProps

export default QuestionBlock
