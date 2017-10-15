import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import { FREERestrictionTypes } from '../../../lib/constants'

const propTypes = {
  description: PropTypes.string,
  options: PropTypes.shape({
    restrictions: PropTypes.shape({
      max: PropTypes.number,
      min: PropTypes.number,
      type: PropTypes.string,
    }),
  }),
  title: PropTypes.string,
}

const defaultProps = {
  description: 'DESCRIPTION',
  options: {
    restrictions: null,
  },
  title: 'TITLE',
}

const FREECreationPreview = ({ title, options: { restrictions }, description }) => {
  const restrictedToNumbers =
    restrictions &&
    restrictions.type === FREERestrictionTypes.RANGE &&
    (restrictions.min || restrictions.max)

  return (
    <div className="preview">
      <div className="title">{title || 'TITLE'}</div>
      <div className="description">{description || 'DESCRIPTION'}</div>
      {restrictedToNumbers && (
        <div className="diagram">
          <div className="min">
            <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />:{' '}
            {restrictions.min}
          </div>
          <div className="max">
            <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />:{' '}
            {restrictions.max}
          </div>
          <div className="line" />
          <div className="box" />
        </div>
      )}
      {restrictedToNumbers ? (
        <div className="selection">
          {/* TODO how to align title horizontally centered? */}
          <b className="title">
            <FormattedMessage defaultMessage="Selection" id="teacher.createQuestion.selection" />
          </b>
          <div className="box">{(+restrictions.min + +restrictions.max) / 2}</div>
        </div>
      ) : (
        <div>
          <div className="freeText">
            <div className="box" />
          </div>
          {restrictions &&
            restrictions.min && (
              <div>
                <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />:{' '}
                {restrictions.min}
              </div>
            )}
          {restrictions &&
            restrictions.max && (
              <div>
                <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />:{' '}
                {restrictions.max}
              </div>
            )}
        </div>
      )}
      <div className="button">
        <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
      </div>

      <style jsx>{`
        .preview {
          display: flex;
          flex-direction: column;

          border: 1px solid lightgrey;
          height: 100%;
          padding: 1rem;
        }

        .title,
        .description,
        .selection {
          margin-bottom: 1rem;
        }

        .title {
          font-weight: bold;
        }

        .button {
          align-self: flex-end;

          border: 2px solid lightgrey;
          padding: 0.5rem;
        }

        .diagram > .max {
          float: right;
        }

        .diagram > .line {
          top: 0;
          left: 0;
          width: 100%;
          height: 0.1rem;
          background: #000;
        }

        .diagram > .box {
          position: relative;
          top: -1rem;
          left: 50%;
          width: 1rem;
          height: 2rem;
          background: grey;
        }

        .selection {
          display: flex;
          align-self: flex-end;
        }

        .selection > .box {
          border: 1px solid lightgrey;
          padding: 0.5rem 2rem;
          margin-left: 1rem;
        }

        .freeText {
          border: 1px solid lightgrey;
          padding: 0.5rem 1rem;
          height: 4rem;
          width: 100%;
          margin-bottom: 1rem;
        }

        .freeText > .box {
          height: 50%;
          width: 0;
          border-left: 0.2rem solid black;
        }
      `}</style>
    </div>
  )
}

FREECreationPreview.propTypes = propTypes
FREECreationPreview.defaultProps = defaultProps

export default FREECreationPreview
