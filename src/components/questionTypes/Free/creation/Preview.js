// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

import type { FREEOptionsType } from '../../../../types'

type Props = {
  description: string,
  options: FREEOptionsType,
  title: string,
}

const defaultProps = {
  description: 'DESCRIPTION',
  options: {
    restrictions: {
      max: null,
      min: null,
      type: 'NONE',
    },
  },
  title: 'TITLE',
}

const Preview = ({ title, options, description }: Props) => (
  <div className="preview">
    <div className="title">{title || 'TITLE'}</div>
    <div className="description">{description || 'DESCRIPTION'}</div>
    {options.restrictions.type === 'NUMBERS' &&
      options.restrictions.min &&
      options.restrictions.max && (
        <div className="diagram">
          <div className="min">{options.restrictions.min}</div>
          <div className="max">{options.restrictions.max}</div>
          <div className="line" />
          <div className="box" />
        </div>
      )}
    {options.restrictions.type === 'NUMBERS' &&
      options.restrictions.min &&
      options.restrictions.max && (
        <div className="selection">
          {/* TODO how to align title horizontally centered? */}
          <b className="title">Selection:</b>
          <div className="box">{(+options.restrictions.min + +options.restrictions.max) / 2}</div>
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
      .description {
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
    `}</style>
  </div>
)

Preview.defaultProps = defaultProps

export default Preview
