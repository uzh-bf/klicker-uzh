import React from 'react'
import { FormattedMessage } from 'react-intl'

import QuestionDescription from '../QuestionDescription'
import SCAnswerOptions from './SCAnswerOptions'
import { convertToMd } from '../../../lib/utils/slateMdConversion'

interface Props {
  description?: string
  options?: {
    choices: any[]
  }
}

const defaultProps = {
  description: '',
  options: {
    choices: [],
  },
}

function SCCreationPreview({ description, options }: Props): React.ReactElement {
  return (
    <div className="preview">
      <div className="description">
        <QuestionDescription content={convertToMd(description)} />
      </div>

      <div className="options">
        <SCAnswerOptions disabled options={options.choices} />
      </div>

      <div className="button">
        <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
      </div>

      <style jsx>{`
        @import 'src/theme';

        .preview {
          display: flex;
          flex-direction: column;

          border: 1px solid lightgrey;
          height: 100%;
          padding: 1rem;

          @include desktop-tablet-only {
            min-height: 18.5rem;
          }
        }

        .title,
        .description,
        .options {
          margin-bottom: 1rem;
        }

        .options {
          max-height: 12rem;
          overflow-y: auto;
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
}

SCCreationPreview.defaultProps = defaultProps

export default SCCreationPreview
