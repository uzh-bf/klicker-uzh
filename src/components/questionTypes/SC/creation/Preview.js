// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

import AnswerOptions from '../answer/Options'

import type { OptionType } from '../../../../types'

type Props = {
  description: string,
  options: Array<OptionType>,
  title: string,
}

const defaultProps = {
  description: 'DESCRIPTION',
  title: 'TITLE',
}

const Preview = ({ title, description, options }: Props) => (
  <div className="preview">
    <div className="title">{title || 'TITLE'}</div>
    <div className="description">{description || 'DESCRIPTION'}</div>
    <div className="options">
      <AnswerOptions
        activeOption={-1}
        options={(options.length === 0 && [{ name: 'OPTION' }]) || options}
        onOptionClick={f => () => f}
      />
    </div>
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
      .options {
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
