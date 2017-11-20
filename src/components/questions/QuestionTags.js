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
    {tags.map(tag => (
      <div className="tag" key={tag.id}>
        {tag.name}
      </div>
    ))}
    <div className="type tag">{type}</div>

    <style jsx>{`
      @import 'src/theme';

      .questionTags {
        display: flex;
        flex-flow: row wrap;

        .tag {
          background-color: #f1f1f1;
          padding: 0.3rem 0.5rem;
          flex: 1;
          text-align: center;
          border-left: solid 1px $color-primary;
          border-top: 1px solid $color-primary;

          &:last-child {
            border-right: solid 1px $color-primary;
          }
        }

        .type {
          font-weight: bold;
          background-color: rgba(33, 133, 208, 0.36);
          // rgba(33, 133, 208, 0.36) // rgba(242, 113, 28, 0.58)
        }

        @include desktop-tablet-only {
          align-items: flex-end;
          flex-flow: row nowrap;
          justify-content: flex-end;

          .tag {
            //background: none;
            padding: 0.5rem 1rem;
            flex: 0 1 auto;
          }
        }
      }
    `}</style>
  </div>
)

QuestionTags.propTypes = propTypes

export default QuestionTags
