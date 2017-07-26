import React from 'react'
import PropTypes from 'prop-types'

const QuestionTags = ({ tags, type }) =>
  (<div className="container">
    <div className="type tag">
      {type}
    </div>
    {tags.map(tag =>
      (<div className="tag">
        {tag}
      </div>),
    )}

    <style jsx>{`
      .container {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
      }
      .tag {
        border-top: solid 1px;
        padding: 0.5rem 1rem;
        text-align: center;
      }
      .tag:last-child {
        border-bottom: solid 1px;
      }
      .type {
        font-weight: bold;
      }

      @media all and (min-width: 768px) {
        .container {
          align-items: flex-end;
          flex-direction: row;
          justify-content: flex-end;
        }
        .tag {
          border-left: solid 1px;
        }
        .tag:last-child {
          border-bottom: 0;
          border-right: solid 1px;
        }
      }
    `}</style>
  </div>)

QuestionTags.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
  type: PropTypes.string.isRequired,
}

export default QuestionTags
