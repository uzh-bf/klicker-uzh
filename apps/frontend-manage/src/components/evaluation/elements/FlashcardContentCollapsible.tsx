import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const [contentElem, setContentElem] = useState<HTMLDivElement | null>(null)
  const [contentCollapsed, setContentCollapsed] = useState<boolean>(true)
  const [showExtensibleButton, setShowExtensibleButton] =
    useState<boolean>(false)

  useEffect(() => {
    if (!contentElem) return

    // if the element height is larger than what is shown or the content was opened, show the extension button
    if (
      contentElem?.scrollHeight > contentElem?.clientHeight ||
      !contentCollapsed
    ) {
      setShowExtensibleButton(true)
    } else {
      setShowExtensibleButton(false)
    }

    return () => setContentElem(null)
  }, [contentCollapsed, contentElem])

  return (
    <div>
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

      <div
        ref={(ref) => setContentElem(ref)}
        className={twMerge(
          contentCollapsed
            ? 'max-h-[7rem]'
            : 'max-h-[calc(100vh-11rem)] overflow-auto',
          showExtensibleButton &&
            contentCollapsed &&
            'overflow-y-hidden bg-gradient-to-b from-black via-black to-white bg-clip-text',
          !showExtensibleButton && 'border-uzh-grey-80 border-b',
          'w-full px-4'
        )}
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
      </div>

      {showExtensibleButton && (
        <Button
          className={{
            root: twMerge(
              'border-uzh-grey-80 h-6 w-full rounded-none border-0 border-b text-xs shadow-none print:hidden',
              contentCollapsed && 'bg-gradient-to-b from-white to-slate-100'
            ),
          }}
          onClick={() => setContentCollapsed(!contentCollapsed)}
          data={{ cy: 'toggle-flashcard-collapse-evaluation' }}
        >
          <Button.Icon
            withoutLabel
            icon={contentCollapsed ? faChevronDown : faChevronUp}
            className={{
              root: 'h-5 w-5',
            }}
          />
        </Button>
      )}
    </div>
  )
}

export default FlashcardContentCollapsible
