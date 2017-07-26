import React from 'react'
import PropTypes from 'prop-types'

const QuestionSingle = ({ id, type, title }) =>
  (<div className="container">
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
      .container {
        background-color: white;
        border: 1px solid grey;
        display: flex;
        flex-flow: row wrap;
        padding: 0.3rem;
        width: 100%;
      }
      .id,
      .type {
        display: border-box;
        padding-bottom: 0.3rem;
        width: 50%;
      }
      .type {
        text-align: right;
      }
      .content {
        border-top: 1px solid grey;
        padding-top: 0.3rem;
        width: 100%;
      }
    `}</style>
  </div>)

QuestionSingle.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default QuestionSingle
