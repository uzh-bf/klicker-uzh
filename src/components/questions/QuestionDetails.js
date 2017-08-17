// @flow

import * as React from 'react';
import { FormattedMessage } from 'react-intl'

import ListWithHeader from '../common/ListWithHeader'

type Props = {
  lastUsed: Array<string>,
}

const QuestionDetails = ({ lastUsed }: Props) =>
  (<div className="container">
    <div className="column">Test1</div>
    <div className="column">Test2</div>
    <div className="column">Test3</div>

    {lastUsed.length > 0 &&
      <div className="column">
        <ListWithHeader items={lastUsed}>
          <FormattedMessage id="questionPool.question.lastUsed" defaultMessage="Last used" />
        </ListWithHeader>
      </div>}

    <style jsx>{`
      .container {
        background-color: lightgrey;
        border: 1px solid grey;
        display: flex;
        flex-flow: column nowrap;
      }
      .column {
        text-align: center;
      }

      @media all and (min-width: 768px) {
        .container {
          flex-flow: row nowrap;
          min-height: 7rem;
        }
        .column {
          flex: 1;
          padding: 1rem;
          text-align: left;
        }
        .column:not(:last-child) {
          border-right: 1px solid grey;
        }
      }
    `}</style>
  </div>)

export default QuestionDetails
