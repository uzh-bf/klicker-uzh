import React from 'react'
import PropTypes from 'prop-types'

const QuestionSingle = ({ id, type, title }) =>
  (<div className="questionSingle">
    <div className="id">
      {id}
    </div>
    <div className="type">
      {type}
    </div>
    <div className="content">
      {title}
    </div>

    <style jsx>{`
      .questionSingle {
        background-color: white;
        display: flex;
        flex-flow: row wrap;
        padding: 0.3rem;
      }
      .id,
      .type {
        flex: 1;
        padding-bottom: 0.3rem;
      }
      .type {
        text-align: right;
      }
      .content {
        border-top: 1px solid lightgrey;
        flex: 0 0 100%;
        padding-top: 0.3rem;
      }
    `}</style>
  </div>)

QuestionSingle.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default QuestionSingle
