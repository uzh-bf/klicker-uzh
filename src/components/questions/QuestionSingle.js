import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  index: PropTypes.number,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  version: PropTypes.number,
}

const defaultProps = {
  index: undefined,
  version: 0,
}

const QuestionSingle = ({
  index, type, title, version,
}) => (
  <div className="questionSingle">
    <div className="type">
      {index && `#${index} - `}
      <FormattedMessage defaultMessage={type} id={`common.${type}.short`} />
    </div>
    <div className="title">
      {title} (v{version + 1})
    </div>

    <style jsx>{`
      @import 'src/theme';

      .questionSingle {
        padding: 0.3rem;
        border: 1px solid $color-primary !important;
        background-color: $color-primary-background;

        .type {
          margin-bottom: 0.3rem;
          padding: 0.1rem 0;

          background-color: $color-primary-20p;
          text-align: center;
        }

        .title {
          text-align: center;
        }
      }
    `}</style>
  </div>
)

QuestionSingle.propTypes = propTypes
QuestionSingle.defaultProps = defaultProps

export default QuestionSingle
