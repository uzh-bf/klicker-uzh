import { Markdown } from '@klicker-uzh/markdown'
import { Prose } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import ContentCollapsible from './ContentCollapsible'

function QuestionCollapsible({
  content,
  proseSize,
  maxExpandedHeight,
}: {
  content: string
  proseSize: string
  maxExpandedHeight?: string
}) {
  return (
    <ContentCollapsible maxExpandedHeight={maxExpandedHeight}>
      <Prose className={{ root: 'max-w-full' }}>
        <Markdown
          className={{
            root: twMerge(
              'prose-p:m-0 prose-lg prose-img:m-0 content-between py-2 leading-8',
              proseSize
            ),
          }}
          content={content}
        />
      </Prose>
    </ContentCollapsible>
  )
}

export default QuestionCollapsible
