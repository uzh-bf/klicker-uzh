import React from 'react'
import PropTypes from 'prop-types'
import { injectIntl, intlShape } from 'react-intl'
import { generateTypesShort } from '../../lib'

const propTypes = {
  intl: intlShape.isRequired,
  noDetails: PropTypes.bool,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  version: PropTypes.number,
}

const defaultProps = {
  noDetails: false,
  version: 0,
}

const QuestionSingle = ({
  type, intl, title, version, noDetails,
}) => (
  <div className="questionSingle">
    <div className="type">
      {generateTypesShort(intl)[type]}
    </div>
    <div className="title">
      {title}
      {' '}
      {!noDetails && (
        <span>
          (v
          {version + 1}
          )
        </span>
      )}
    </div>

    <style jsx>
      {`
        @import 'src/theme';

        .questionSingle {
          border: 1px solid $color-primary !important;
          background-color: $color-primary-background;

          .type,
          .title {
            padding: 0.2rem 0;
          }

          .type {
            background-color: $color-primary-20p;
            text-align: center;
          }

          .title {
            text-align: center;
            color: $color-primary-strong;
          }
        }
      `}
    </style>
  </div>
)

QuestionSingle.propTypes = propTypes
QuestionSingle.defaultProps = defaultProps

export default injectIntl(QuestionSingle)
