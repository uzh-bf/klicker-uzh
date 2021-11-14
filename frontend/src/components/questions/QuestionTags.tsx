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
          <div className="border border-b-0 border-solid border-primary tag bg-primary-bg" key={tag.id}>
            {tag.name}
          </div>
        )
      )}

      <div className="font-bold border border-b-0 border-l-0 border-solid border-primary tag bg-primary-50">
        {generateTypesShort(intl)[type]}
      </div>

      <style jsx>{`
        @import 'src/theme';

        .questionTags {
          display: flex;
          flex-flow: row wrap;

          .tag {
            padding: 0.3rem 0.5rem;
            flex: 1;
            text-align: center;
          }

          @include desktop-tablet-only {
            align-items: flex-end;
            flex-flow: row nowrap;
            justify-content: flex-end;

            .tag {
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
