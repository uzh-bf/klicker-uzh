// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

type Props = {
  description: string,
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
    {
      options.restrictions.type === 'NUMBERS' &&
      <div className="diagram">
        <p>Min: {options.restrictions.min}</p>
        <p>Max: {options.restrictions.max}</p>
        <div className="line" />
        <div className="box" />
      </div>
    }
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
    `}</style>
  </div>
)

Preview.defaultProps = defaultProps

export default Preview
