import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _isFinite from 'lodash/isFinite'
import { Icon } from 'semantic-ui-react'
import { QUESTION_TYPES } from '../../constants'

const propTypes = {
  children: PropTypes.element.isRequired,
  color: PropTypes.string,
  correct: PropTypes.bool,
  marker: PropTypes.string,
  percentage: PropTypes.number,
  reverse: PropTypes.bool,
  showGraph: PropTypes.bool,
}

const defaultProps = {
  color: undefined,
  correct: false,
  marker: undefined,
  percentage: undefined,
  reverse: false,
  showGraph: false,
}

const EvaluationListItem = ({
  color,
  correct,
  children,
  marker,
  reverse,
  percentage,
  questionType,
  showGraph,
}) => (
  <div className={classNames('evaluationListItem', { correct, reverse })}>
    {color && (
      <div className="colorSquare">
        <Icon name="square icon" />
      </div>
    )}

    {marker && reverse && <div className="marker">{marker}</div>}
    <div className="content">{children}</div>
    {QUESTION_TYPES.WITH_PERCENTAGES.includes(questionType) &&
      showGraph &&
      _isFinite(percentage) && <div className="percentage">{percentage}%</div>}
    {marker && !reverse && <div className="marker">{marker}</div>}

    <style jsx>{`
      @import 'src/theme';

      .evaluationListItem {
        display: flex;
        flex-flow: row wrap;
        align-items: center;

        padding: 0.1rem 0;

        border-bottom: 1px solid lightgrey;

        &:first-child {
          border-top: 1px solid lightgrey;
        }

        &.correct {
          background-color: $color-correct;
        }

        .colorSquare :global(i) {
          flex: 0 0 auto;

          color: ${color};
        }

        .marker {
          flex: 0 0 1.5rem;
          text-align: center;

          font-weight: bold;
        }

        .content {
          flex: 1;
        }

        .percentage {
          flex: 0 0 2rem;
          font-size: 0.8rem;
          text-align: right;
        }

        &.reverse {
          justify-content: space-between;

          .marker,
          .content {
            flex: 0 0 auto;
          }
        }
      }
    `}</style>
  </div>
)

EvaluationListItem.propTypes = propTypes
EvaluationListItem.defaultProps = defaultProps

export default EvaluationListItem
