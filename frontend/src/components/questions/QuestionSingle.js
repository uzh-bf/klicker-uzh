import React from 'react'
import PropTypes from 'prop-types'

const propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  version: PropTypes.number,
}

const defaultProps = {
  version: 0,
}

const QuestionSingle = ({ type, title, version }) => (
  <div className="questionSingle">
    <div className="title">
      {title} (v{version + 1})
    </div>
    <div className="type">{type}</div>

    <style jsx>{`
      @import 'src/theme';

      .questionSingle {
        display: flex;
        flex-flow: row wrap;
        padding: 0.3rem;
        border: 1px solid $color-primary !important;
        background-color: $color-primary-background;

        .title {
          flex: 1;
        }
        .type {
          flex: 0 0 auto;
          text-align: right;
        }
      }
    `}</style>
  </div>
)

QuestionSingle.propTypes = propTypes
QuestionSingle.defaultProps = defaultProps

export default QuestionSingle
