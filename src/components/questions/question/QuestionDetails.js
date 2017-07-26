import React from 'react'
import PropTypes from 'prop-types'
import { Segment } from 'semantic-ui-react'

import ListWithHeader from '../../common/ListWithHeader'

const QuestionDetails = ({ lastUsed }) =>
  (<Segment className="wrapper">
    <div className="container">
      <div className="column">Test1</div>
      <div className="column">Test2</div>
      <div className="column">Test3</div>

      {lastUsed.length > 0 &&
        <div className="column">
          <ListWithHeader items={lastUsed}>hello</ListWithHeader>
        </div>}

      <style jsx>{`
        :global(.segment.wrapper) {
          background-color: lightgrey;
          min-height: 7rem;
          width: 100%;
        }

        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-around;
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
            padding: 0 1rem;
            text-align: left;
          }
          .column:not(:last-child) {
            border-right: 1px solid grey;
          }
        }
      `}</style>
    </div>
  </Segment>)

QuestionDetails.propTypes = {
  lastUsed: PropTypes.arrayOf(PropTypes.string),
}

QuestionDetails.defaultProps = {
  lastUsed: [],
}

export default QuestionDetails
