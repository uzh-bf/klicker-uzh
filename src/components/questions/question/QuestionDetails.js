import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import ListWithHeader from '../../common/ListWithHeader'

const QuestionDetails = ({ lastUsed }) =>
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
        flex-direction: column;
        justify-content: space-around;
        min-height: 7rem;
      }
      .column {
        text-align: center;
      }

      @media all and (min-width: 768px) {
        .container {
          flex-direction: row;
        }
        .column {
          flex: 1 1 25%;
          padding: 1rem;
          text-align: left;
        }
        .column:not(:last-child) {
          border-right: 1px solid grey;
        }
      }
    `}</style>
  </div>)

QuestionDetails.propTypes = {
  lastUsed: PropTypes.arrayOf(PropTypes.string),
}

QuestionDetails.defaultProps = {
  lastUsed: [],
}

export default QuestionDetails
