import React from 'react'
import PropTypes from 'prop-types'

const QuestionSingle = ({ id, type, title }) =>
  (<div className="container">
    <div className="id">
      <span>
        {id.slice(0, 7)}
      </span>
    </div>
    <div className="type">
      <span>
        {type}
      </span>
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
        width: 100%;
      }
      .id,
      .type {
        border-bottom: 1px solid grey;
        display: border-box;
        padding: 0.3rem 0;
        width: 50%;
      }
      .type {
        text-align: right;
      }
      .id > span {
        margin-left: 0.3rem;
      }
      .type > span {
        margin-right: 0.3rem;
      }
      .content {
        padding: 0.3rem;
        width: 100%;
      }

      @media all and (min-width: 768px) {
        .container {
          max-width: 15rem;
        }
      }
    `}</style>
  </div>)

QuestionSingle.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default QuestionSingle
