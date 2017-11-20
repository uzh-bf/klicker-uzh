import React from 'react'
import PropTypes from 'prop-types'

import { Icon } from 'semantic-ui-react'

const propTypes = {
  children: PropTypes.element.isRequired,
  color: PropTypes.string,
  marker: PropTypes.string,
}

const defaultProps = {
  color: undefined,
  marker: undefined,
}

const EvaluationListItem = ({ color, children, marker }) => (
  <div className="evaluationListItem">
    {color && (
      <div className="colorSquare">
        <Icon name="square icon" />
      </div>
    )}
    <div className="content">{children}</div>
    {marker && <div className="marker">{marker}</div>}

    <style jsx>{`
      .evaluationListItem {
        display: flex;
        flex-flow: row wrap;
        align-items: center;

        padding: 0.1rem 0;

        border-bottom: 1px solid lightgrey;

        &:first-child {
          border-top: 1px solid lightgrey;
        }

        .colorSquare :global(i) {
          flex: 0 0 auto;

          color: ${color};
        }

        .marker {
          flex: 0 0 auto;

          font-weight: bold;
        }

        .content {
          flex: 1;
        }
      }
    `}</style>
  </div>
)

EvaluationListItem.propTypes = propTypes
EvaluationListItem.defaultProps = defaultProps

export default EvaluationListItem
