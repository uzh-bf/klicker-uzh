// @flow

import React from 'react'
import { Icon } from 'semantic-ui-react'

import QuestionSingle from './QuestionSingle'

type Props = {
  questions?: Array<{
    id: string,
    title: string,
    type: string,
  }>,
  showSolutions?: boolean,
  status?: string,
  timeLimit?: number,
}

const QuestionBlock = ({ questions = [], showSolutions = false, status, timeLimit }: Props) =>
  (<div className="questionBlock">
    {status
      ? <div className="timeLimit">
        {status}
      </div>
      : <div className="timeLimit">
        <Icon name="clock" />
        {timeLimit}s
        </div>}
    {status
      ? <div className="showSolution">
        {status}
      </div>
      : <div className="showSolution">
        <Icon name={showSolutions ? 'unhide' : 'hide'} />
      </div>}
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

export default QuestionBlock
