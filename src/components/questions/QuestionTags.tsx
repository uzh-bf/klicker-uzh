import React from 'react'
import { useIntl } from 'react-intl'

import { generateTypesShort } from '../../lib/utils/lang'

interface Props {
  tags: { id: string; name: string }[]
  type: string
}

function QuestionTags({ tags, type }: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <div className="questionTags">
      {tags.map(
        (tag): React.ReactElement => (
          <div className="tag" key={tag.id}>
            {tag.name}
          </div>
        )
      )}

      <div className="type tag">{generateTypesShort(intl)[type]}</div>

      <style jsx>{`
        @import 'src/theme';

        .questionTags {
          display: flex;
          flex-flow: row wrap;

          .tag {
            background-color: #f1f1f1;
            padding: 0.3rem 0.5rem;
            flex: 1;
            text-align: center;
            border-left: solid 1px $color-primary;
            border-top: 1px solid $color-primary;

            &:last-child {
              border-right: solid 1px $color-primary;
            }
          }

          .type {
            font-weight: bold;
            background-color: rgba(33, 133, 208, 0.36);
            // rgba(33, 133, 208, 0.36) // rgba(242, 113, 28, 0.58)
          }

          @include desktop-tablet-only {
            align-items: flex-end;
            flex-flow: row nowrap;
            justify-content: flex-end;

            .tag {
              //background: none;
              padding: 0.5rem 1rem;
              flex: 0 1 auto;
            }
          }
        }
      `}</style>
    </div>
  )
}

export default QuestionTags
