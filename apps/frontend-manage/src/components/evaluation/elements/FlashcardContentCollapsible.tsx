import { Markdown } from '@klicker-uzh/markdown'
import { Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ContentCollapsible from './ContentCollapsible'

function FlashcardContentCollapsible({
  content,
  explanation,
  proseSize,
}: {
  content: string
  explanation?: string
  proseSize: string
}) {
  const t = useTranslations()

  return (
    <ContentCollapsible
      staticContent={
        <div className="grid grid-cols-2 bg-slate-50">
          <div className="border-r border-slate-200 px-4 py-2 text-lg font-semibold">
            {t('manage.evaluation.frontSide')}
          </div>
          {explanation && (
            <div className="px-4 py-2 text-lg font-semibold">
              {t('manage.evaluation.backSide')}
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2">
        <div className="border-r py-2 pr-4">
          <Prose className={{ root: 'max-w-full' }}>
            <Markdown
              className={{
                root: twMerge(
                  'prose-p:m-0 prose-lg prose-img:m-0 leading-8',
                  proseSize
                ),
              }}
              content={content}
            />
          </Prose>
        </div>

        {explanation && (
          <div className="py-2 pl-4">
            <Prose className={{ root: 'max-w-full' }}>
              <Markdown
                className={{
                  root: twMerge(
                    'prose-p:m-0 prose-lg prose-img:m-0 leading-8',
                    proseSize
                  ),
                }}
                content={explanation}
              />
            </Prose>
          </div>
        )}
      </div>
    </ContentCollapsible>
  )
}

export default FlashcardContentCollapsible
