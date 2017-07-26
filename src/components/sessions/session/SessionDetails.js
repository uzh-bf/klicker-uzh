import React from 'react'
import PropTypes from 'prop-types'

import QuestionBlock from './QuestionBlock'

const SessionDetails = ({ blocks }) =>
  (<div className="container">
    {blocks.map(block =>
      (<div className="block">
        <QuestionBlock
          questions={block.questions}
          showSolutions={block.showSolutions}
          timeLimit={block.timeLimit}
        />
      </div>),
    )}

    <style jsx>{`
      .container {
        background-color: lightgrey;
        border: 1px solid grey;
        display: flex;
        flex-direction: column;
        padding: 0.5rem;
      }

      @media all and (min-width: 768px) {
        .container {
          flex-direction: row;
        }
        .block:not(:first-child) {
          margin-left: 1rem;
        }
      }
    `}</style>
  </div>)

SessionDetails.propTypes = {
  blocks: PropTypes.arrayOf(PropTypes.shape({})),
}

SessionDetails.defaultProps = {
  blocks: [],
}

export default SessionDetails
