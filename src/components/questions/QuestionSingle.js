import React from 'react'
import PropTypes from 'prop-types'

const propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

const QuestionSingle = ({ type, title }) => (
  <div className="questionSingle">
    <div className="title">{title}</div>
    <div className="type">{type}</div>

    <style jsx>{`
      @import 'src/theme';

      .questionSingle {
        display: flex;
        flex-flow: row wrap;
        padding: 0.3rem;
        border: 1px solid $color-primary !important;
        background-color: $color-primary-background;

        .title,
        .type {
          flex: 1;
        }
        .type {
          text-align: right;
        }
      }
    `}</style>
  </div>
)

QuestionSingle.propTypes = propTypes

export default QuestionSingle
