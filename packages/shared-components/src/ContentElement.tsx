import { faBookOpen, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import DynamicMarkdown from './evaluation/DynamicMarkdown'

interface ContentelementProps {
  element: ElementInstance
  read: boolean
  onRead: () => void
  elementIx: number
  hideReadButton?: boolean
}

function ContentElement({
  element,
  read,
  onRead,
  elementIx,
  hideReadButton = false,
}: ContentelementProps) {
  const t = useTranslations()

  return (
    <div
      className="mb-4 flex flex-col"
      data-cy={`content-element-${elementIx}`}
    >
      <div className="flex-1">
        <div
          className={twMerge(
            'relative max-w-none flex-initial rounded border border-slate-300 p-2 pb-0 leading-6'
          )}
        >
          <span className="absolute right-2 top-1 text-sm text-slate-400">
            <FontAwesomeIcon icon={faBookOpen} />
          </span>
          <DynamicMarkdown
            content={element.elementData.content}
            withProse
            data={{ cy: `content-element-md-${elementIx}` }}
            className={{ root: 'p-2' }}
          />
        </div>
      </div>
      {!hideReadButton && (
        <div className="mt-2 flex justify-end">
          <Button
            primary={!read}
            disabled={read}
            onClick={onRead}
            className={{
              root: twMerge(
                'h-8 border-0 shadow-sm',
                read && 'bg-green-600 text-white hover:bg-green-700'
              ),
            }}
            data={{ cy: `read-content-element-${elementIx}` }}
          >
            <Button.Icon icon={faCheck} />
            <Button.Label>{t('pwa.practiceQuiz.read')}</Button.Label>
          </Button>
        </div>
      )}
    </div>
  )
}

export default ContentElement
