import React from 'react'
import PropTypes from 'prop-types'

const propTypes = {
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  type: PropTypes.string.isRequired,
}

const QuestionTags = ({ tags, type }) => (
  <div className="questionTags">
    <div className="type tag">{type}</div>
    {tags.map(tag => (
      <div key={tag.id} className="tag">
        {tag.name}
      </div>
    ))}

    <style jsx>{`
      .questionTags {
        display: flex;
        flex-flow: row wrap;

        .type {
          font-weight: bold;
        }

        .tag {
          background-color: lightgrey;
          padding: 0.3rem 0.5rem;
          flex: 1;
          text-align: center;
        }

        @media all and (min-width: 768px) {
          align-items: flex-end;
          flex-flow: row nowrap;
          justify-content: flex-end;

          .tag {
            background: none;
            border-left: solid 1px;
            border-top: 1px solid grey;
            padding: 0.5rem 1rem;
            flex: 0 1 auto;

            &:last-child {
              border-right: solid 1px;
            }
          }
        }
      }
    `}</style>
  </div>
)

QuestionTags.propTypes = propTypes

export default QuestionTags
