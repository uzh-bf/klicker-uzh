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
      <div className="diagram">Hello I am a diagram</div>
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

        border: 1px solid lightgrey;
        padding: 0.5rem;
      }
    `}</style>
  </div>
)

Preview.defaultProps = defaultProps

export default Preview
